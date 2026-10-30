/**
 * HTTPS server + HTTP→HTTPS redirect for the Express backend (task 11.5.1).
 *
 * EVERYTHING in this module that touches sockets, the filesystem, or TLS certs
 * is invoked ONLY from the `listen()` entry path (see `server/index.ts`), NEVER
 * from `createApp()`. That keeps the app importable and drivable in-process by
 * supertest over plain HTTP, with no cert generation at import time.
 *
 * The redirect LOGIC is extracted into {@link buildHttpsRedirectLocation} and
 * {@link httpToHttpsRedirectHandler} as pure functions so the 308 behaviour can
 * be unit-tested without opening a socket (Property 25).
 *
 *  - {@link buildHttpsRedirectLocation}: maps an inbound HTTP host+path to the
 *    equivalent `https://host:<httpsPort>/path` location, swapping any inbound
 *    port for the HTTPS port.
 *  - {@link httpToHttpsRedirectHandler}: a `node:http` request listener that
 *    replies `308 Permanent Redirect` with that `Location` to every request.
 *  - {@link loadOrCreateCert}: load an existing self-signed key/cert pair from
 *    the gitignored `certs/` folder, or generate one with `selfsigned`.
 *  - {@link startHttpsServer}: build the HTTPS server + the plain-HTTP redirect
 *    listener. Called only from the entry path.
 *
 * @see design.md "Local TLS (api)"
 * Requirements 15.1, 15.2
 */

import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { Application } from "express";

/** Default HTTPS port for the backend (the API listens here). */
export const HTTPS_PORT = 3001;
/** Default plain-HTTP port that only issues redirects to HTTPS. */
export const HTTP_REDIRECT_PORT = 3080;

/** Directory holding the gitignored self-signed cert pair. */
const CERTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "certs"
);
const KEY_PATH = path.join(CERTS_DIR, "localhost-key.pem");
const CERT_PATH = path.join(CERTS_DIR, "localhost-cert.pem");

/**
 * Build the HTTPS `Location` for an inbound plain-HTTP request. Pure function:
 * given the request `Host` header (host[:port]) and URL path, return the
 * equivalent `https://host:<httpsPort><path>`. The inbound port (if any) is
 * replaced by `httpsPort`; the path (including query) is preserved verbatim.
 *
 * @param hostHeader the inbound `Host` header, e.g. `localhost:3080`
 * @param url the inbound request URL/path, e.g. `/api/health?x=1`
 * @param httpsPort the HTTPS port to redirect to
 */
export function buildHttpsRedirectLocation(
  hostHeader: string | undefined,
  url: string | undefined,
  httpsPort: number = HTTPS_PORT
): string {
  // Strip any existing port from the host; default to localhost.
  const rawHost = (hostHeader ?? "localhost").trim();
  const hostOnly = rawHost.replace(/:\d+$/, "") || "localhost";
  const pathPart = url && url.length > 0 ? url : "/";
  const withSlash = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  return `https://${hostOnly}:${httpsPort}${withSlash}`;
}

/**
 * A `node:http` request listener that answers EVERY request with a `308`
 * permanent redirect to the equivalent HTTPS location. Exported pure so it can
 * be unit-tested by passing a fake req/res (Property 25) without a real socket.
 */
export function httpToHttpsRedirectHandler(
  httpsPort: number = HTTPS_PORT
): (req: http.IncomingMessage, res: http.ServerResponse) => void {
  return (req, res) => {
    const location = buildHttpsRedirectLocation(
      req.headers.host,
      req.url,
      httpsPort
    );
    res.statusCode = 308;
    res.setHeader("Location", location);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(`Permanent Redirect to ${location}`);
  };
}

/** A loaded (or freshly generated) TLS key/cert pair. */
export interface CertPair {
  key: string;
  cert: string;
}

/**
 * Load the self-signed key/cert pair from `certs/`, or generate a new one with
 * `selfsigned` and write it there (the folder is gitignored). This touches the
 * filesystem and is therefore ONLY called from the entry path.
 */
export async function loadOrCreateCert(): Promise<CertPair> {
  if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
    return {
      key: fs.readFileSync(KEY_PATH, "utf-8"),
      cert: fs.readFileSync(CERT_PATH, "utf-8"),
    };
  }

  const require = createRequire(import.meta.url);
  const selfsigned = require("selfsigned") as {
    generate(
      attrs: { name: string; value: string }[],
      opts: Record<string, unknown>
    ): Promise<{ private: string; cert: string }>;
  };

  const attrs = [{ name: "commonName", value: "localhost" }];
  const pems = await selfsigned.generate(attrs, {
    days: 825,
    keySize: 2048,
    algorithm: "sha256",
    extensions: [
      {
        name: "subjectAltName",
        altNames: [
          { type: 2, value: "localhost" }, // DNS
          { type: 7, ip: "127.0.0.1" }, // IP
        ],
      },
    ],
  });

  fs.mkdirSync(CERTS_DIR, { recursive: true });
  fs.writeFileSync(KEY_PATH, pems.private, "utf-8");
  fs.writeFileSync(CERT_PATH, pems.cert, "utf-8");
  return { key: pems.private, cert: pems.cert };
}

/** Handles returned by {@link startHttpsServer} for lifecycle management. */
export interface HttpsServers {
  httpsServer: https.Server;
  redirectServer: http.Server;
}

/**
 * Start the HTTPS server for the Express `app` plus the plain-HTTP redirect
 * listener. ONLY call from the entry path — it generates/loads certs and binds
 * sockets. Returns the server handles so the caller can close them.
 */
export async function startHttpsServer(
  app: Application,
  options: { httpsPort?: number; httpPort?: number } = {}
): Promise<HttpsServers> {
  const httpsPort = options.httpsPort ?? HTTPS_PORT;
  const httpPort = options.httpPort ?? HTTP_REDIRECT_PORT;

  const { key, cert } = await loadOrCreateCert();
  const httpsServer = https.createServer({ key, cert }, app);
  httpsServer.listen(httpsPort, () => {
    // eslint-disable-next-line no-console
    console.log(`[role-match] HTTPS API listening on https://localhost:${httpsPort}`);
  });

  const redirectServer = http.createServer(httpToHttpsRedirectHandler(httpsPort));
  redirectServer.listen(httpPort, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[role-match] HTTP→HTTPS redirect listening on http://localhost:${httpPort}`
    );
  });

  return { httpsServer, redirectServer };
}
