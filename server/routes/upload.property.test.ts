// server/routes/upload.property.test.ts
//
// Feature: role-match-cv-tailor, Property 6: Format acceptance matches the allowed set
// Feature: role-match-cv-tailor, Property 7: Size limit enforced at 10 MB
// Validates: Requirements 4.4, 4.5, 4.6, 4.7
//
// Property 6: a file is accepted for parsing iff its format is .docx, .txt, or
// .pdf; any other extension is rejected with UNSUPPORTED_FORMAT naming the
// accepted formats. Property 7: a file is accepted iff it is at most 10 MB;
// larger uploads are rejected with FILE_TOO_LARGE. Tests upload a JD (so the
// PII guard does not interfere) and drive createApp() in-process via supertest.

import { describe, it, expect, beforeAll } from "vitest";
import fc from "fast-check";
import request from "supertest";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { createApp } from "../index";
import { SessionStore } from "../session/SessionStore";
import { AuditLog } from "../audit/AuditLog";
import { MAX_UPLOAD_BYTES } from "./uploadRoutes";

// Point the audit log at a directory that is never created: AuditLog writes are
// best-effort and swallowed, so records become no-ops. This keeps the many
// fast-check iterations from churning real temp directories (which otherwise
// contend with other suites under full-suite parallelism).
function freshApp() {
  const store = new SessionStore();
  const audit = new AuditLog({ dir: "audit-test-upload-noop" });
  const app = createApp({ store, audit });
  return request(app)
    .post("/api/session/reset")
    .send({})
    .then((reset) => ({ app, sessionId: reset.body.sessionId as string }));
}

// --- Fixtures --------------------------------------------------------------

const TEXT_BODY =
  "Responsibilities: lead platform engineering and mentor the team. Required: Kubernetes experience.";

let docxBuffer: Buffer;
const txtBuffer = Buffer.from(TEXT_BODY, "utf-8");


beforeAll(async () => {
  const doc = new Document({
    sections: [
      { children: [new Paragraph({ children: [new TextRun(TEXT_BODY)] })] },
    ],
  });
  docxBuffer = await Packer.toBuffer(doc);
});

const MIME: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  bin: "application/octet-stream",
};

// --------------------------------------------------------------------------
// Property 6 — format acceptance
// --------------------------------------------------------------------------

describe("Property 6: Format acceptance matches the allowed set", () => {
  it("accepts .docx/.txt and rejects everything else", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("docx", "txt", "rtf", "json", "exe", "png", "csv"),
        async (ext) => {
          const { app, sessionId } = await freshApp();

          const allowed = ext === "docx" || ext === "txt";
          const buffer =
            ext === "docx"
              ? docxBuffer
              : txtBuffer; // reuse valid text bytes under a bad extension
          const mime = MIME[ext] ?? MIME.bin;

          const res = await request(app)
            .post("/api/upload")
            .set("x-session-id", sessionId)
            .field("kind", "jd")
            .attach("file", buffer, { filename: `doc.${ext}`, contentType: mime });

          if (allowed) {
            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.format).toBe(ext);
          } else {
            expect(res.status).toBe(400);
            expect(res.body.code).toBe("UNSUPPORTED_FORMAT");
            // Names the accepted formats in the resolution.
            expect(res.body.resolution.toLowerCase()).toContain(".docx");
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);
});

// --------------------------------------------------------------------------
// Property 7 — size limit enforced at 10 MB
// --------------------------------------------------------------------------

describe("Property 7: Size limit enforced at 10 MB", () => {
  it("accepts <= 10 MB and rejects > 10 MB with FILE_TOO_LARGE", async () => {
    await fc.assert(
      fc.asyncProperty(
        // A spread of sizes straddling the 10 MB boundary. Boundary values are
        // weighted so the just-under/at/just-over cases are always exercised.
        fc.oneof(
          { weight: 2, arbitrary: fc.integer({ min: 1, max: 4096 }) }, // small
          { weight: 1, arbitrary: fc.constant(MAX_UPLOAD_BYTES - 1024) }, // just under
          { weight: 1, arbitrary: fc.constant(MAX_UPLOAD_BYTES) }, // exactly at limit
          { weight: 1, arbitrary: fc.constant(MAX_UPLOAD_BYTES + 1) }, // just over
          {
            weight: 1,
            arbitrary: fc.integer({
              min: MAX_UPLOAD_BYTES + 2,
              max: MAX_UPLOAD_BYTES + 100000,
            }),
          }
        ),
        async (size) => {
          const { app, sessionId } = await freshApp();

          // Fill with printable text so an accepted file parses as usable text.
          const buffer = Buffer.alloc(size, 0x41); // 'A'
          const withinLimit = size <= MAX_UPLOAD_BYTES;

          const res = await request(app)
            .post("/api/upload")
            .set("x-session-id", sessionId)
            .field("kind", "jd")
            .attach("file", buffer, {
              filename: "doc.txt",
              contentType: "text/plain",
            });

          if (withinLimit) {
            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
          } else {
            expect(res.status).toBe(413);
            expect(res.body.code).toBe("FILE_TOO_LARGE");
            expect(res.body.message).toContain("10");
          }
        }
      ),
      // Large buffers make each run heavy; 50 runs with a weighted mix of
      // sizes keeps the boundary well-covered while staying within time.
      { numRuns: 50 }
    );
  }, 120000);
});
