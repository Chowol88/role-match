// server/routes/analyze.property.test.ts
//
// Feature: role-match-cv-tailor, Property 5: Missing-document message names exactly what is missing
// Feature: role-match-cv-tailor, Property 24: Agreement gate withholds results and downloads
// Validates: Requirements 4.1, 4.2, 13.1, 13.4
//
// Property 5: for any combination of CV-present / JD-present where at least one
// is absent, /api/analyze withholds analysis and MISSING_DOCUMENT names exactly
// the missing document(s). Property 24: for any request to view results or
// download while the user agreement is unconfirmed, the system withholds the
// result and the downloads (AGREEMENT_REQUIRED). Both drive createApp() via
// supertest with an injected store/audit — no network, no real ports.

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import request from "supertest";
import type { Application } from "express";
import { createApp } from "../index";
import { SessionStore } from "../session/SessionStore";
import { AuditLog } from "../audit/AuditLog";

const CV_TEXT = [
  "Professional Profile",
  "Engineer delivering platform work with Kubernetes.",
  "",
  "Professional Experience",
  "Led the platform team.",
].join("\n");

const JD_TEXT = ["Responsibilities:", "- Kubernetes experience required"].join(
  "\n"
);

// Audit writes are best-effort; point at a never-created dir so records are
// no-ops and the many fast-check iterations do not churn real temp directories.
async function freshApp() {
  const store = new SessionStore();
  const audit = new AuditLog({ dir: "audit-test-analyze-noop" });
  const app = createApp({ store, audit });
  const reset = await request(app).post("/api/session/reset").send({});
  return { app, sessionId: reset.body.sessionId as string };
}

async function confirmAgreement(app: Application, sessionId: string) {
  await request(app)
    .post("/api/session/agreement")
    .set("x-session-id", sessionId)
    .send({ confirmed: true });
}

async function uploadText(
  app: Application,
  sessionId: string,
  kind: "cv" | "jd",
  text: string
) {
  return request(app)
    .post("/api/upload")
    .set("x-session-id", sessionId)
    .field("kind", kind)
    .attach("file", Buffer.from(text, "utf-8"), {
      filename: `${kind}.txt`,
      contentType: "text/plain",
    });
}

// --------------------------------------------------------------------------
// Property 5 — missing-document message names exactly what is missing
// --------------------------------------------------------------------------

describe("Property 5: Missing-document message names exactly what is missing", () => {
  it("withholds analysis and names exactly the missing document(s)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.boolean(),
        async (cvPresent, jdPresent) => {
          fc.pre(!(cvPresent && jdPresent)); // at least one absent

          const { app, sessionId } = await freshApp();
          await confirmAgreement(app, sessionId); // isolate the missing-doc path

          if (cvPresent) await uploadText(app, sessionId, "cv", CV_TEXT);
          if (jdPresent) await uploadText(app, sessionId, "jd", JD_TEXT);

          const res = await request(app)
            .post("/api/analyze")
            .set("x-session-id", sessionId)
            .send({});

          expect(res.status).toBe(400);
          expect(res.body.code).toBe("MISSING_DOCUMENT");
          expect(res.body.result).toBeUndefined();

          const msg = res.body.message.toLowerCase();
          const mentionsCv = msg.includes("cv");
          const mentionsJd =
            msg.includes("job description") || msg.includes("jd");

          // Names exactly what is missing — and NOT what is present.
          expect(mentionsCv).toBe(!cvPresent);
          expect(mentionsJd).toBe(!jdPresent);
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);
});

// --------------------------------------------------------------------------
// Property 24 — agreement gate withholds results and downloads
// --------------------------------------------------------------------------

describe("Property 24: Agreement gate withholds results and downloads", () => {
  it("withholds analyze/tailor/downloads until the agreement is confirmed", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          "/api/analyze",
          "/api/tailor",
          "/api/download/cv"
        ),
        async (endpoint) => {
          const { app, sessionId } = await freshApp();
          // Provide both documents so the ONLY thing withholding is the gate.
          await uploadText(app, sessionId, "cv", CV_TEXT);
          await uploadText(app, sessionId, "jd", JD_TEXT);

          // Agreement NOT confirmed → the request must be withheld.
          const blocked = await request(app)
            .post(endpoint)
            .set("x-session-id", sessionId)
            .send({ acceptedEditIds: [] });

          expect(blocked.status).toBe(403);
          expect(blocked.body.code).toBe("AGREEMENT_REQUIRED");
          expect(blocked.body.result).toBeUndefined();

          // After confirming, the same request is no longer gate-blocked.
          await confirmAgreement(app, sessionId);
          const allowed = await request(app)
            .post(endpoint)
            .set("x-session-id", sessionId)
            .send({ acceptedEditIds: [] });

          expect(allowed.status).not.toBe(403);
          if (allowed.body && allowed.body.code) {
            expect(allowed.body.code).not.toBe("AGREEMENT_REQUIRED");
          }
        }
      ),
      { numRuns: 60 }
    );
  }, 90000);
});
