/**
 * Shared request-parsing helpers for the REST routes.
 *
 * Every endpoint except `POST /api/session/reset` requires a sessionId, carried
 * either in the `x-session-id` header or a `sessionId` body field. These helpers
 * extract and validate it, throwing the typed `UNKNOWN_SESSION` error (via the
 * {@link SessionStore}) when the id is missing or unknown, so the error
 * middleware returns a consistent `{ code, message, resolution }` response.
 *
 * @see design.md "REST API" ("Every request carries a sessionId … the server
 *   rejects unknown sessions with a clear error.")
 * Requirements 11.4, 11.5, 14.2
 */

import type { Request } from "express";
import type { SessionState } from "../../shared/types";
import type { SessionStore } from "../session/SessionStore";
import { makeError } from "./errors";

/**
 * Read the sessionId from the `x-session-id` header or the request body. Returns
 * undefined when neither is present (a non-empty string otherwise).
 */
export function readSessionId(req: Request): string | undefined {
  const header = req.header("x-session-id");
  if (typeof header === "string" && header.trim().length > 0) {
    return header.trim();
  }
  const body = (req.body ?? {}) as { sessionId?: unknown };
  if (typeof body.sessionId === "string" && body.sessionId.trim().length > 0) {
    return body.sessionId.trim();
  }
  return undefined;
}

/**
 * Resolve the live {@link SessionState} for a request, or throw the typed
 * `UNKNOWN_SESSION` error when the id is missing or the session is unknown.
 */
export function requireSession(req: Request, store: SessionStore): SessionState {
  const sessionId = readSessionId(req);
  if (!sessionId) {
    throw makeError("UNKNOWN_SESSION");
  }
  // SessionStore.get throws the UNKNOWN_SESSION AppError when absent.
  return store.get(sessionId);
}
