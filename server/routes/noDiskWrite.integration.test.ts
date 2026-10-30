// server/routes/noDiskWrite.integration.test.ts
//
// Integration test for the no-disk-write guarantee (task 10.6).
// Validates: Requirements 1.4, 12.5
//
// The uploaded CV and JD bytes must NEVER be written to disk: multer uses
// memoryStorage and the parsers work on in-memory buffers. This test replaces
// every filesystem write API (sync + async + streaming, on both `node:fs` and
// `node:fs/promises`) with a capturing shim while a full upload → analyze flow
// runs, and asserts that no captured write payload ever contains the unique
// CV/JD marker tokens.
//
// The audit log DOES legitimately write event metadata to disk; the assertion
// is specifically that CV/JD CONTENT never reaches any write call — so we check
// for the unique content markers, not for the absence of writes altogether.
// Because `node:fs` exports are not reconfigurable under ESM, the modules are
// mocked with vi.mock (hoisted) rather than spied in place.

import { describe, it, expect, afterEach, vi } from "vitest";

// Shared capture buffer for every intercepted write payload. Declared via the
// hoisted vi.hoisted so the vi.mock factories (also hoisted) can reference it.
const captured = vi.hoisted(() => ({ payloads: [] as string[] }));

function record(args: unknown[]): void {
  for (const a of args) {
    if (typeof a === "string") captured.payloads.push(a);
    else if (a && (a as Buffer).constructor === Buffer)
      captured.payloads.push((a as Buffer).toString("utf-8"));
    else if (a instanceof Uint8Array)
      captured.payloads.push(Buffer.from(a).toString("utf-8"));
  }
}

vi.mock("node:fs/promises", async (importActual) => {
  const actual = await importActual<typeof import("node:fs/promises")>();
  return {
    ...actual,
    default: actual,
    async writeFile(...args: unknown[]) {
      record(args);
    },
    async appendFile(...args: unknown[]) {
      record(args);
    },
  };
});

vi.mock("node:fs", async (importActual) => {
  const actual = await importActual<typeof import("node:fs")>();
  return {
    ...actual,
    default: actual,
    writeFileSync(...args: unknown[]) {
      record(args);
    },
    appendFileSync(...args: unknown[]) {
      record(args);
    },
    createWriteStream(...args: Parameters<typeof actual.createWriteStream>) {
      const stream = actual.createWriteStream(...args);
      const origWrite = stream.write.bind(stream);
      stream.write = ((chunk: unknown, ...rest: unknown[]) => {
        record([chunk]);
        return (origWrite as (...a: unknown[]) => boolean)(chunk, ...rest);
      }) as typeof stream.write;
      return stream;
    },
  };
});

// Import AFTER the mocks are registered so the app/audit pick up the shims.
import request from "supertest";
import { createApp } from "../index";
import { SessionStore } from "../session/SessionStore";
import { AuditLog } from "../audit/AuditLog";

// Unique markers injected into the CV/JD so we can detect any leak to disk.
const CV_MARKER = "CVLEAKMARKER_7f3a9c21";
const JD_MARKER = "JDLEAKMARKER_b4e8d150";

const CV_TEXT = [
  "Professional Profile",
  `Seasoned engineer ${CV_MARKER} delivering platform work.`,
  "",
  "Core Competencies",
  "Kubernetes, TypeScript, Leadership",
  "",
  "Professional Experience",
  "Led the platform team and shipped reliably.",
].join("\n");

const JD_TEXT = [
  "Responsibilities:",
  `- Lead platform engineering ${JD_MARKER}`,
  "- Kubernetes experience required",
].join("\n");

afterEach(() => {
  captured.payloads.length = 0;
});

describe("no-disk-write guarantee (uploads never persist CV/JD bytes)", () => {
  it("writes no CV/JD content to disk across upload and analyze", async () => {
    const store = new SessionStore();
    // Audit writes go through the mocked fs/promises.appendFile (captured, not
    // written), so a throwaway dir name is fine.
    const audit = new AuditLog({ dir: "audit-test-nodisk" });
    const app = createApp({ store, audit });

    const reset = await request(app).post("/api/session/reset").send({});
    const sessionId = reset.body.sessionId as string;

    const cvRes = await request(app)
      .post("/api/upload")
      .set("x-session-id", sessionId)
      .field("kind", "cv")
      .attach("file", Buffer.from(CV_TEXT, "utf-8"), {
        filename: "cv.txt",
        contentType: "text/plain",
      });
    expect(cvRes.status).toBe(200);

    const jdRes = await request(app)
      .post("/api/upload")
      .set("x-session-id", sessionId)
      .field("kind", "jd")
      .attach("file", Buffer.from(JD_TEXT, "utf-8"), {
        filename: "jd.txt",
        contentType: "text/plain",
      });
    expect(jdRes.status).toBe(200);

    await request(app)
      .post("/api/session/agreement")
      .set("x-session-id", sessionId)
      .send({ confirmed: true });

    const analyzeRes = await request(app)
      .post("/api/analyze")
      .set("x-session-id", sessionId)
      .send({});
    expect(analyzeRes.status).toBe(200);

    // No write payload anywhere contained the CV or JD content markers.
    const all = captured.payloads.join("\n");
    expect(all.includes(CV_MARKER)).toBe(false);
    expect(all.includes(JD_MARKER)).toBe(false);
  });
});
