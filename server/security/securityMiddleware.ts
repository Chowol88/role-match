/**
 * Security middleware for the Express backend (tasks 11.5.3 + 11.5.4).
 *
 * This module provides three pieces of hardening, all mounted INSIDE
 * `createApp()` so they apply to every in-process (supertest) request as well
 * as the real HTTPS server — NONE of them opens a socket or requires a
 * certificate, so the app remains importable and testable over plain HTTP:
 *
 *  1. {@link buildHelmet} — helmet configured for a local single-page app:
 *     HSTS, a CSP that permits the SPA's own origin + inline styles (Vite dev),
 *     `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and
 *     `Referrer-Policy: no-referrer`. (Requirement 15.3)
 *  2. {@link buildCors} — cors locked to the local app origin ONLY. A request
 *     whose `Origin` is anything else is NOT granted an
 *     `Access-Control-Allow-Origin` reflecting it. Same-origin / no-Origin
 *     requests (e.g. the SPA served from the same host, or a server-to-server
 *     call) are allowed. (Requirement 15.4)
 *  3. {@link buildApiRateLimiter} — express-rate-limit on `/api` routes,
 *     surfacing the typed `RATE_LIMITED` error shape when the window is
 *     exceeded. (Requirement 15.5)
 *
 * @see design.md "Security headers", "CORS", "Rate limiting"
 * Requirements 15.3, 15.4, 15.5
 */

import type { RequestHandler } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { ERROR_COPY } from "../routes/errors";

/** The HTTPS origins the local SPA is served from (Vite dev + API host). */
export const LOCAL_ORIGINS: readonly string[] = [
  "https://localhost:5173",
  "https://localhost:3001",
  "https://127.0.0.1:5173",
  "https://127.0.0.1:3001",
];

/** True when `origin` is one of the permitted local app origins. */
export function isLocalOrigin(origin: string | undefined): boolean {
  // No Origin header (same-origin navigations, curl, server-to-server) is not
  // a cross-origin request — it is allowed; CORS only governs cross-origin.
  if (!origin) return true;
  return LOCAL_ORIGINS.includes(origin);
}

/**
 * Build the helmet middleware for the local SPA (Requirement 15.3). The CSP is
 * deliberately permissive enough for a locally-served React SPA (self + inline
 * styles the dev server injects) while still constraining script/object/frame
 * ancestors.
 */
export function buildHelmet(): RequestHandler {
  return helmet({
    // HSTS: force HTTPS for a long max-age (local certs are trusted once).
    hsts: {
      maxAge: 15552000, // 180 days
      includeSubDomains: true,
    },
    // CSP suited to a local SPA. `connect-src` allows the loopback API/ws.
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "https://localhost:*", "wss://localhost:*"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    referrerPolicy: { policy: "no-referrer" },
    // X-Frame-Options: DENY (clickjacking). helmet's frameguard default is
    // SAMEORIGIN; force DENY per the task.
    frameguard: { action: "deny" },
    // X-Content-Type-Options: nosniff is on by default; kept explicit.
    noSniff: true,
  });
}

/**
 * Build the cors middleware locked to the local app origin(s) only
 * (Requirement 15.4). A disallowed origin receives NO allow-origin header
 * reflecting it (the cors package simply omits the header), so the browser
 * blocks the cross-origin read.
 */
export function buildCors(): RequestHandler {
  return cors({
    origin(origin, callback) {
      if (isLocalOrigin(origin)) {
        // Reflect the specific allowed origin (or allow no-Origin requests).
        callback(null, true);
      } else {
        // Not an error (that would 500); just DON'T grant CORS for this origin.
        callback(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-session-id"],
  });
}

/**
 * Build the rate limiter for `/api` routes (Requirement 15.5). Generous for a
 * single local user but bounded; exceeding the window returns the typed
 * `RATE_LIMITED` error body with HTTP 429.
 */
export function buildApiRateLimiter(
  options: { windowMs?: number; max?: number } = {}
): RequestHandler {
  const windowMs = options.windowMs ?? 60_000; // 1 minute
  const max = options.max ?? 300; // 300 requests / minute / IP
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      code: "RATE_LIMITED",
      message: ERROR_COPY.RATE_LIMITED.message,
      resolution: ERROR_COPY.RATE_LIMITED.resolution,
    },
  });
}
