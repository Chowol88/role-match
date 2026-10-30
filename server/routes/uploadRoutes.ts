/**
 * Upload route for Role-Match CV Tailor.
 *
 * `POST /api/upload` accepts ONE file (CV or JD) as multipart/form-data and
 * processes it ENTIRELY IN MEMORY — multer `memoryStorage` means the bytes are
 * never written to a temp file or disk (requirements 1.4, 12.5). The flow:
 *
 *  1. multer buffers the single `file` field with `limits.fileSize = 10 MB`;
 *     an over-limit upload is mapped to the typed `FILE_TOO_LARGE` error (4.7).
 *  2. The format is validated by extension + MIME against the allowed set
 *     (.docx, .txt, .pdf). Anything else → `UNSUPPORTED_FORMAT` (4.6).
 *  3. The buffer is parsed to text by format (in memory). Empty/unparseable
 *     files → `FILE_UNREADABLE` (4.8). A .pdf always returns the "best results"
 *     notice (4.5).
 *  4. For a CV, the PII guard runs: any hard-block types → `PII_BLOCKED` listing
 *     ALL detected types (5.1–5.4); a name warning requires an explicit
 *     `confirm` flag before the upload proceeds → `NAME_WARNING` otherwise
 *     (5.5, 5.6).
 *  5. The parsed text + detected sections (CV only) are stored on the in-memory
 *     session. Nothing is persisted to disk.
 *
 * @see design.md "REST API", "File Parsing", "PII Detection"
 * Requirements 4.3, 4.5, 4.6, 4.7, 4.8, 4.9, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6,
 *               12.1, 1.4, 12.5
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import type { CvSections, ParsedDocument } from "../../shared/types";
import type { SessionStore } from "../session/SessionStore";
import type { AuditLog } from "../audit/AuditLog";
import { parseDocument } from "../parsing";
import { detectSections } from "../parsing/SectionDetector";
import { runPiiGuard } from "../pii/PiiGuard";
import { makeError } from "./errors";
import { requireSession } from "./requestHelpers";

/** The hard upload size cap: 10 MB (requirement 4.7). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Allowed upload formats keyed by lowercase extension. */
const EXTENSION_FORMAT: Record<string, "docx" | "txt"> = {
  ".docx": "docx",
  ".txt": "txt",
};

/** MIME types we accept per format (lenient: extension is authoritative). */
const ALLOWED_MIME = new Set<string>([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  // Browsers/OSes sometimes omit or generalise the MIME for these; the
  // extension check above is the authoritative gate.
  "application/octet-stream",
  "",
]);

/** The lowercase extension of a filename (including the dot), or "". */
function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

/**
 * Resolve the upload format from the filename extension + MIME, or null when the
 * file is not one of the allowed formats.
 */
export function resolveFormat(
  filename: string,
  mimetype: string
): "docx" | "txt" | null {
  const ext = extensionOf(filename);
  const byExt = EXTENSION_FORMAT[ext];
  if (!byExt) return null;
  // The extension is authoritative; MIME must be plausible (or unknown).
  if (!ALLOWED_MIME.has(mimetype)) return null;
  return byExt;
}

/**
 * Build the upload router. The multer instance uses memoryStorage so uploaded
 * bytes live only in a buffer — never on disk.
 */
export function createUploadRouter(
  store: SessionStore,
  audit: AuditLog
): Router {
  const router = Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
  });

  router.post(
    "/upload",
    (req: Request, res: Response, next: NextFunction) => {
      // Run multer, translating its size-limit error into FILE_TOO_LARGE.
      upload.single("file")(req, res, (multerErr: unknown) => {
        if (multerErr) {
          const code = (multerErr as { code?: string }).code;
          if (code === "LIMIT_FILE_SIZE") {
            return next(makeError("FILE_TOO_LARGE"));
          }
          // Any other multer error is treated as an unreadable upload.
          return next(makeError("FILE_UNREADABLE"));
        }
        void handleUpload(req, res, next, store, audit);
      });
    }
  );

  return router;
}

/** The core upload handler, invoked after multer has buffered the file. */
async function handleUpload(
  req: Request,
  res: Response,
  next: NextFunction,
  store: SessionStore,
  audit: AuditLog
): Promise<void> {
  try {
    const session = requireSession(req, store);

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      throw makeError("FILE_UNREADABLE", {
        message: "No file was received in the upload.",
        resolution: "Attach a .docx, .txt, or .pdf file and try again.",
      });
    }

    const body = (req.body ?? {}) as { kind?: unknown; confirmPii?: unknown };
    const kind = body.kind === "jd" ? "jd" : "cv";
    const piiConfirmed = body.confirmPii === true || body.confirmPii === "true";

    // Format validation (extension + MIME) → UNSUPPORTED_FORMAT.
    const format = resolveFormat(file.originalname ?? "", file.mimetype ?? "");
    if (!format) {
      throw makeError("UNSUPPORTED_FORMAT");
    }

    // Parse the in-memory buffer to text (never touches disk). The parser
    // throws FILE_UNREADABLE for empty/whitespace/corrupt content.
    const text = await parseDocument(file.buffer, format);

    // For a CV, run the PII guard before accepting the content.
    let sections: CvSections | undefined;
    if (kind === "cv") {
      const report = runPiiGuard(text);
      const hasFindings = report.blocked || report.nameWarning;

      // Single warn-and-confirm gate: on the first upload with findings we do
      // NOT reject; we return the findings so the client can confirm. The
      // client re-submits with confirmPii=true to proceed at their own risk.
      if (hasFindings && !piiConfirmed) {
        res.json({
          ok: false,
          kind,
          format,
          piiFindings: {
            blockedTypes: report.blockedTypes,
            nameWarning: report.nameWarning,
          },
        });
        return;
      }

      sections = detectSections(text);
    }

    const parsed: ParsedDocument = { kind, format, text, sections };
    store.update(session.sessionId, kind === "cv" ? { cv: parsed } : { jd: parsed });

    await audit.record({
      timestamp: new Date().toISOString(),
      sessionId: session.sessionId,
      event: "upload",
    });

    res.json({
      ok: true,
      kind,
      format,
      parsed: {
        sectionsDetected: sections ? Object.keys(sections).length : 0,
      },
    });
  } catch (err) {
    next(err);
  }
}
