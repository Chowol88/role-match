/**
 * Download route for Role-Match CV Tailor: POST /api/download/cv only.
 * Builds the tailored .docx from accepted edits (fixed filename, no versioning),
 * gated by the user agreement. Nothing is written to disk.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import type { ProposedEdit, SessionState } from "../../shared/types";
import type { SessionStore } from "../session/SessionStore";
import type { AuditLog } from "../audit/AuditLog";
import { buildCvDocx } from "../output/CvDocxBuilder";
import { makeError } from "./errors";
import { requireSession } from "./requestHelpers";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function requireAgreement(session: SessionState): void {
  if (!session.agreementConfirmed) throw makeError("AGREEMENT_REQUIRED");
}

function applyAcceptance(
  edits: ReadonlyArray<ProposedEdit>,
  acceptedIds: ReadonlyArray<string>
): ProposedEdit[] {
  const accepted = new Set(acceptedIds);
  return edits.map((e) => ({ ...e, accepted: accepted.has(e.id) }));
}

export function createDownloadRouter(store: SessionStore, audit: AuditLog): Router {
  const router = Router();

  router.post("/download/cv", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = requireSession(req, store);
      requireAgreement(session);

      if (!session.cv) {
        throw makeError("MISSING_DOCUMENT", {
          message: "Missing the CV.",
          resolution: "Upload the CV before downloading a tailored version.",
        });
      }

      const body = (req.body ?? {}) as { acceptedEditIds?: unknown };
      const acceptedEditIds = Array.isArray(body.acceptedEditIds)
        ? body.acceptedEditIds.filter((i): i is string => typeof i === "string")
        : [];

      const edits = applyAcceptance(session.edits ?? [], acceptedEditIds);

      const result = await buildCvDocx({
        cvText: session.cv.text,
        sections: session.cv.sections,
        edits,
      });

      await audit.record({
        timestamp: new Date().toISOString(),
        sessionId: session.sessionId,
        event: "download_cv",
      });

      res.setHeader("Content-Type", DOCX_MIME);
      res.setHeader("Content-Disposition", result.contentDisposition);
      res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
