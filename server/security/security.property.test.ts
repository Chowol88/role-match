// server/security/security.property.test.ts
//
// Security hardening properties driven by supertest in-process against
// createApp() — no real sockets, ports, or certificates are used.
//
// Feature: role-match-cv-tailor, Property 26: Security headers present on API responses
//   Validates: Requirements 15.3
// Feature: role-match-cv-tailor, Property 27: CORS rejects non-local origins
//   Validates: Requirements 15.4
// Feature: role-match-cv-tailor, Property 28: Error output never contains the API key
//   Validates: Requirements 15.7

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import request from "supertest";
import type { Application } from "express";
import { createApp } from "../index";
import { SessionStore } from "../session/SessionStore";
import { AuditLog } from "../audit/AuditLog";
import { redactSecrets, REDACTED } from "./redactErrors";
import { LOCAL_ORIGINS } from "./securityMiddleware";

/** Fresh app with an isolated store + a no-op audit log and no rate limiting. */
function freshApp(): { app: Application; store: SessionStore } {
  const store = new SessionStore();
  const audit = new AuditLog({ dir: "audit-test-security-noop" });
  const app = createApp({ store, audit, disableRateLimit: true });
  return { app, store };
}

async function mintSession(app: Application): Promise<string> {
  const reset = await request(app).post("/api/session/reset").send({});
  return reset.body.sessionId as string;
}

// --------------------------------------------------------------------------
// Property 26 — security headers present on API responses
// --------------------------------------------------------------------------

describe("Property 26: Security headers present on API responses", () => {
  it("every API response carries HSTS, CSP, nosniff, X-Frame-Options DENY, Referrer-Policy", async () => {
    const { app } = freshApp();
    const sessionId = await mintSession(app);

    // Hit a couple of representative API responses.
    const responses = [
      await request(app).get("/api/health"),
      await request(app).post("/api/session/reset").send({ sessionId }),
    ];

    for (const res of responses) {
      const h = res.headers;
      expect(h["strict-transport-security"]).toMatch(/max-age=\d+/);
      expect(h["content-security-policy"]).toBeDefined();
      expect(h["content-security-policy"]).toContain("default-src");
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["referrer-policy"]).toBe("no-referrer");
    }
  });
});

// --------------------------------------------------------------------------
// Property 27 — CORS rejects non-local origins
// --------------------------------------------------------------------------

describe("Property 27: CORS rejects non-local origins", () => {
  it("does not reflect a disallowed Origin in Access-Control-Allow-Origin", async () => {
    const { app } = freshApp();

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          "https://evil.example.com",
          "http://localhost:5173", // wrong scheme (http, not https)
          "https://attacker.test",
          "https://localhost:9999", // wrong port
          "null"
        ),
        async (origin) => {
          const res = await request(app)
            .get("/api/health")
            .set("Origin", origin);
          const allow = res.headers["access-control-allow-origin"];
          // The disallowed origin must NOT be reflected back.
          expect(allow === origin).toBe(false);
        }
      )
    );
  }, 30000);

  it("allows the local HTTPS app origin", async () => {
    const { app } = freshApp();
    const origin = LOCAL_ORIGINS[0];
    const res = await request(app).get("/api/health").set("Origin", origin);
    // The cors middleware reflects the specific allowed origin.
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
  });
});

// --------------------------------------------------------------------------
// Property 28 — error output never contains the API key
// --------------------------------------------------------------------------

describe("Property 28: Error output never contains the API key", () => {
  // Unit-level: the serializer the error middleware uses redacts key-ish fields
  // regardless of the raw value, so an error carrying a key cannot leak it.
  it("redacts apiKey/authorization/key fields for any raw key", () => {
    fc.assert(
      fc.property(
        // A distinctive prefix guarantees the generated key value cannot
        // collide with the fixed copy / field names in the fixture.
        fc.string({ minLength: 1, maxLength: 64 }).map((s) => `RAWKEY_${s}_END`),
        (rawKey) => {
          const err = {
            code: "AI_CALL_FAILED",
            message: "upstream failure",
            resolution: "retry or switch to Free mode",
            apiKey: rawKey,
            Authorization: `Bearer ${rawKey}`,
            nested: { key: rawKey, deep: { "x-api-key": rawKey } },
          };
          const redacted = redactSecrets(err) as Record<string, unknown>;
          const serialised = JSON.stringify(redacted);

          // The raw key value never survives serialisation anywhere.
          expect(serialised.includes(rawKey)).toBe(false);
          // Key-ish fields are replaced with the redaction marker.
          expect(redacted.apiKey).toBe(REDACTED);
          expect(redacted.Authorization).toBe(REDACTED);
          const nested = redacted.nested as Record<string, unknown>;
          expect(nested.key).toBe(REDACTED);
          const deep = nested.deep as Record<string, unknown>;
          expect(deep["x-api-key"]).toBe(REDACTED);
          // Non-secret copy is preserved untouched.
          expect(redacted.message).toBe("upstream failure");
        }
      )
    );
  }, 30000);

  // Integration: drive a route that errors while a raw key is held in the
  // session, and assert the serialised HTTP error contains no raw key.
  it("HTTP error body contains no raw key while a key is in session memory", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 8, maxLength: 48 }).map((s) => `sk-${s}`),
        async (rawKey) => {
          const { app, store } = freshApp();
          const sessionId = await mintSession(app);
          // Place a raw key in backend memory for the session.
          store.setApiKey(sessionId, "openai", rawKey);

          // Drive an error path: analyze with no CV/JD + no agreement → a typed
          // error is serialised through the error middleware.
          const res = await request(app)
            .post("/api/analyze")
            .set("x-session-id", sessionId)
            .send({});

          expect(res.status).toBeGreaterThanOrEqual(400);
          const body = JSON.stringify(res.body) + (res.text ?? "");
          expect(body.includes(rawKey)).toBe(false);
        }
      ),
      { numRuns: 25 }
    );
  }, 30000);
});
