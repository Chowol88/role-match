/**
 * Express application assembly for Role-Match CV Tailor.
 *
 * This module builds the backend HTTP surface (task 10.1):
 *
 *  - JSON body parsing (multipart is handled per-route by multer in the upload
 *    router, so a global multipart parser is intentionally NOT mounted).
 *  - Route mounting under `/api` for the session/key, upload, analyze/tailor,
 *    and download routers.
 *  - A `sessionId` requirement: every route EXCEPT `POST /api/session/reset`
 *    requires a sessionId (header `x-session-id` or body field) and rejects an
 *    unknown/missing session with the typed `UNKNOWN_SESSION` error.
 *  - Error middleware that converts any thrown typed {@link AppError} (including
 *    {@link AiCallFailedError}, which implements the AppError shape) into a
 *    `{ code, message, resolution }` JSON response with an appropriate HTTP
 *    status. Unexpected errors become a generic 500 and never leak internals.
 *
 * {@link createApp} returns the configured app WITHOUT binding a port, so tests
 * can drive it in-process with supertest. The `listen()` call lives behind an
 * entry-point guard so importing this module in a test does not open a socket.
 *
 * Security hardening (task 11.5) is mounted INSIDE {@link createApp} so it
 * applies to in-process (supertest) requests too, WITHOUT opening a socket or
 * requiring a certificate:
 *   - helmet security headers (HSTS, CSP, nosniff, X-Frame-Options, Referrer)
 *   - cors locked to the local HTTPS app origin only
 *   - express-rate-limit on `/api` routes
 *   - the API-key-redacting error serializer, applied in the error middleware
 *     before anything is logged or returned.
 * HTTPS termination and the HTTP→HTTPS redirect live ONLY in the `listen()`
 * entry path (see `server/security/https.ts`) so cert/socket concerns never
 * run at import time.
 *
 * @see design.md "Backend modules", "REST API", "Error Handling", "Security"
 * Requirements 11.4, 11.5, 14.2, 15.3, 15.4, 15.5, 15.7
 */

import express, {
  type Application,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import type { AppError, AppErrorCode } from "../shared/types";
import { SessionStore, sessionStore as defaultStore } from "./session/SessionStore";
import { AuditLog, auditLog as defaultAudit } from "./audit/AuditLog";
import { isAppError } from "./routes/errors";
import { createSessionRouter } from "./routes/sessionRoutes";
import { createUploadRouter } from "./routes/uploadRoutes";
import { createAnalyzeRouter } from "./routes/analyzeRoutes";
import { createDownloadRouter } from "./routes/downloadRoutes";
import {
  buildHelmet,
  buildCors,
  buildApiRateLimiter,
} from "./security/securityMiddleware";
import { redactSecrets } from "./security/redactErrors";
import { startHttpsServer } from "./security/https";

/** The backend port (confirmed decision: Express on 3001). */
export const PORT = 3001;

/** JSON body size cap — conservative for a local single-user app. */
const JSON_BODY_LIMIT = "2mb";

/** Dependencies injectable into {@link createApp} (tests supply their own). */
export interface CreateAppOptions {
  store?: SessionStore;
  audit?: AuditLog;
  /** Override the `/api` rate-limit window/max (tests exercise the limit). */
  rateLimit?: { windowMs?: number; max?: number };
  /** Disable the rate limiter entirely (most tests don't want it). */
  disableRateLimit?: boolean;
}

/**
 * Map a typed {@link AppErrorCode} to the HTTP status the client should see.
 * Validation/guard failures are 4xx; an AI provider failure is a 502 (upstream
 * failure); an unknown session is 404.
 */
function statusForCode(code: AppErrorCode): number {
  switch (code) {
    case "UNKNOWN_SESSION":
      return 404;
    case "FILE_TOO_LARGE":
      return 413;
    case "RATE_LIMITED":
      return 429;
    case "AI_CALL_FAILED":
      return 502;
    case "AGREEMENT_REQUIRED":
      return 403;
    default:
      return 400;
  }
}

/**
 * Build the configured Express application without binding a port.
 *
 * @param options optional injected session store / audit log (defaults to the
 *   process-wide singletons used by the running server)
 */
export function createApp(options: CreateAppOptions = {}): Application {
  const store = options.store ?? defaultStore;
  const audit = options.audit ?? defaultAudit;

  const app = express();

  // --- Security hardening (task 11.5): applied in-process, no sockets/certs.
  // helmet security headers on every response (HSTS, CSP, nosniff, frame deny,
  // referrer-policy) — Requirement 15.3.
  app.use(buildHelmet());
  // CORS locked to the local HTTPS app origin only — Requirement 15.4.
  app.use(buildCors());

  // JSON parsing (multipart is per-route via multer in the upload router).
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: JSON_BODY_LIMIT }));

  // Rate limiting on /api routes — Requirement 15.5. Tests may disable or tune
  // it; by default it is generous for a single local user.
  if (!options.disableRateLimit) {
    app.use("/api", buildApiRateLimiter(options.rateLimit));
  }

  // Liveness check (no session required).
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Route groups under /api. The session router owns reset (the only route that
  // does not require an existing session) plus key validation + agreement.
  app.use("/api", createSessionRouter(store, audit));
  app.use("/api", createUploadRouter(store, audit));
  app.use("/api", createAnalyzeRouter(store, audit));
  app.use("/api", createDownloadRouter(store, audit));

  // Error middleware: typed AppError → { code, message, resolution } JSON.
  // CRITICAL: every error passes through redactSecrets BEFORE it is logged or
  // returned, so a raw API key can never leak via an error field, attached
  // context, or a stack-carried payload (Requirement 15.7 / Property 28).
  app.use(
    (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
      if (isAppError(err)) {
        const body: AppError & Record<string, unknown> = {
          code: err.code,
          message: err.message,
          resolution: err.resolution,
        };
        // Carry through any structured extras routes attach (e.g. the PII
        // blockedTypes list or the nameWarning flag) for the UI.
        const extra = err as unknown as Record<string, unknown>;
        if (Array.isArray(extra.blockedTypes)) {
          body.blockedTypes = extra.blockedTypes;
        }
        if (extra.nameWarning === true) {
          body.nameWarning = true;
        }
        // Redact any key-ish field before returning (defence in depth: a route
        // that attaches context to a typed error cannot leak a key).
        res.status(statusForCode(err.code)).json(redactSecrets(body));
        return;
      }

      // Unexpected error: do not leak internals. Redact before logging too, so
      // the key never reaches the console/log stream.
      // eslint-disable-next-line no-console
      console.error("[api] unexpected error:", redactSecrets(err));
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
        resolution: "Please try again. If the problem persists, restart the app.",
      });
    }
  );

  return app;
}

// ---------------------------------------------------------------------------
// Entry point: start the server only when run directly (never on import).
// ---------------------------------------------------------------------------

/** True when this module is the process entry point (not imported by a test). */
function isMainModule(): boolean {
  if (!process.argv[1]) return false;
  const entry = process.argv[1].replace(/\\/g, "/");
  return entry.endsWith("server/index.ts") || entry.endsWith("server/index.js");
}

if (isMainModule()) {
  // The running server opts into the idle sweeper (tests use a quiet store).
  defaultStore.startSweeper();
  const app = createApp();
  // Entry path only: terminate TLS over HTTPS (cert generated/loaded lazily
  // here, never at import time) and run a plain-HTTP listener that 308-redirects
  // everything to the HTTPS origin (Requirements 15.1, 15.2).
  void startHttpsServer(app, { httpsPort: PORT });
}
