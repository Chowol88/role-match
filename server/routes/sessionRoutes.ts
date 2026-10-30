/**
 * Session lifecycle routes for Role-Match CV Tailor (Free mode only).
 *  - POST /api/session/reset   : create or reset a session, return empty state.
 *  - POST /api/session/agreement : confirm/revoke the user-agreement flag.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import type { SessionStore } from "../session/SessionStore";
import type { AuditLog } from "../audit/AuditLog";
import { requireSession } from "./requestHelpers";

export function createSessionRouter(store: SessionStore, audit: AuditLog): Router {
  const router = Router();

  router.post("/session/reset", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as { sessionId?: unknown };
      const existingId =
        typeof body.sessionId === "string" && body.sessionId.length > 0
          ? body.sessionId
          : undefined;
      const state = store.reset(existingId);
      await audit.record({
        timestamp: new Date().toISOString(),
        sessionId: state.sessionId,
        event: "session_start",
      });
      res.json({ sessionId: state.sessionId, state });
    } catch (err) {
      next(err);
    }
  });

  router.post("/session/agreement", (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = requireSession(req, store);
      const body = (req.body ?? {}) as { confirmed?: unknown };
      const confirmed = body.confirmed === true || body.confirmed === "true";
      const updated = store.update(session.sessionId, { agreementConfirmed: confirmed });
      res.json({ agreementConfirmed: updated.agreementConfirmed });
    } catch (err) {
      next(err);
    }
  });

  // --- POST /api/session/texts -------------------------------------------
  // Return the session's own parsed CV/JD text so the client can build the
  // copy-paste ChatGPT prompt (Option B). The content is the user's own.
  router.post(
    "/session/texts",
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const session = requireSession(req, store);
        res.json({
          cvText: session.cv?.text ?? "",
          jdText: session.jd?.text ?? "",
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
