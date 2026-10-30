// server/security/httpsRedirect.property.test.ts
//
// Feature: role-match-cv-tailor, Property 25: HTTP requests redirect to HTTPS
// Validates: Requirements 15.2
//
// For any request arriving on the plain-HTTP listener, the response is a 308
// permanent redirect to the SAME path on the HTTPS origin. We unit-test the
// exported pure redirect handler + location builder by passing fake req/res
// objects — no socket is opened, so this is safe under the in-process suite.

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  buildHttpsRedirectLocation,
  httpToHttpsRedirectHandler,
  HTTPS_PORT,
} from "./https";

/** A minimal fake ServerResponse capturing status/headers/body. */
function fakeRes(): ServerResponse & {
  _status: number;
  _headers: Record<string, string>;
  _body: string;
} {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    _status: 0,
    _headers: headers,
    _body: "",
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    end(body?: string) {
      res._status = res.statusCode;
      res._body = body ?? "";
    },
  } as unknown as ServerResponse & {
    _status: number;
    _headers: Record<string, string>;
    _body: string;
  };
  return res;
}

describe("Property 25: HTTP requests redirect to HTTPS", () => {
  it("maps http://host/path → https origin on the HTTPS port with 308", () => {
    fc.assert(
      fc.property(
        // Arbitrary request paths (always rooted) and host ports.
        fc
          .array(
            fc
              .string({ minLength: 1, maxLength: 8 })
              .map((s) => s.replace(/[^A-Za-z0-9._~-]/g, "") || "a"),
            { minLength: 0, maxLength: 5 }
          )
          .map((segs) => "/" + segs.join("/")),
        fc.integer({ min: 1, max: 65535 }),
        (path, inboundPort) => {
          const req = {
            headers: { host: `localhost:${inboundPort}` },
            url: path,
          } as unknown as IncomingMessage;
          const res = fakeRes();

          httpToHttpsRedirectHandler(HTTPS_PORT)(req, res);

          expect(res._status).toBe(308);
          const location = res._headers["location"];
          expect(location).toBeDefined();
          // Redirects to HTTPS on the HTTPS port, preserving the path.
          expect(location.startsWith(`https://localhost:${HTTPS_PORT}`)).toBe(true);
          expect(location.endsWith(path)).toBe(true);
          // The inbound HTTP port is NOT carried over.
          expect(location).not.toContain(`:${inboundPort}/`);
        }
      )
    );
  });

  it("defaults host to localhost and path to / when absent", () => {
    const req = { headers: {}, url: undefined } as unknown as IncomingMessage;
    const res = fakeRes();
    httpToHttpsRedirectHandler(HTTPS_PORT)(req, res);
    expect(res._status).toBe(308);
    expect(res._headers["location"]).toBe(`https://localhost:${HTTPS_PORT}/`);
  });

  it("builder preserves query strings and swaps the port", () => {
    const loc = buildHttpsRedirectLocation("localhost:3080", "/api/health?x=1", 3001);
    expect(loc).toBe("https://localhost:3001/api/health?x=1");
  });
});
