/**
 * Analysis and tailoring routes for Role-Match CV Tailor (Free mode only).
 * POST /api/analyze and POST /api/tailor. Both enforce the agreement gate.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import type { MatchResult, SessionState } from "../../shared/types";
import type { SessionStore } from "../session/SessionStore";
import type { AuditLog } from "../audit/AuditLog";
import { analyzeFree } from "../engine/FreeEngine";
import { tailorFree, isTailorRefusal } from "../engine/FreeTailor";
import { makeError } from "./errors";
import { requireSession } from "./requestHelpers";

function requireBothDocuments(session: SessionState): void {
  const hasCv = session.cv !== undefined;
  const hasJd = session.jd !== undefined;
  if (hasCv && hasJd) return;
  let which: string;
  if (!hasCv && !hasJd) which = "both the CV and the job description";
  else if (!hasCv) which = "the CV";
  else which = "the job description";
  throw makeError("MISSING_DOCUMENT", {
    message: `Missing ${which}.`,
    resolution: `Upload ${which} before analysing.`,
  });
}

function requireAgreement(session: SessionState): void {
  if (!session.agreementConfirmed) throw makeError("AGREEMENT_REQUIRED");
}

export function createAnalyzeRouter(store: SessionStore, audit: AuditLog): Router {
  const router = Router();

  router.post("/analyze", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = requireSession(req, store);
      requireAgreement(session);
      requireBothDocuments(session);

      const cvText = session.cv!.text;
      const jdText = session.jd!.text;
      const sections = session.cv!.sections;

      const result: MatchResult = analyzeFree(cvText, jdText, sections);
      store.update(session.sessionId, { result });

      await audit.record({
        timestamp: new Date().toISOString(),
        sessionId: session.sessionId,
        event: "analyze",
        mode: result.mode,
        score: result.score,
      });

      if (result.noRequirements) return res.json({ noRequirements: true });
      res.json({ result });
    } catch (err) {
      next(err);
    }
  });

  router.post("/tailor", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = requireSession(req, store);
      requireAgreement(session);
      requireBothDocuments(session);

      const body = (req.body ?? {}) as { userEvidence?: unknown };
      const userEvidence = Array.isArray(body.userEvidence)
        ? body.userEvidence.filter((u): u is string => typeof u === "string")
        : [];

      const cvText = session.cv!.text;
      const jdText = session.jd!.text;
      const sections = session.cv!.sections;
      const matchResult: MatchResult = session.result ?? analyzeFree(cvText, jdText, sections);

      const outcome = tailorFree(cvText, jdText, matchResult, userEvidence, sections);

      if (isTailorRefusal(outcome)) {
        if (outcome.code === "NO_EDITABLE_SECTIONS") {
          await recordTailor(audit, session.sessionId);
          return res.json({ edits: [], noEditableSections: true });
        }
        throw outcome;
      }

      store.update(session.sessionId, { edits: outcome.edits });
      await recordTailor(audit, session.sessionId);
      res.json({
        edits: outcome.edits,
        unverified: outcome.unverified.length > 0 ? outcome.unverified : undefined,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

async function recordTailor(audit: AuditLog, sessionId: string): Promise<void> {
  await audit.record({ timestamp: new Date().toISOString(), sessionId, event: "tailor" });
}
