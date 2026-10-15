/**
 * The edge's `harden` option: security headers added to proxied responses, never overriding what the
 * origin set itself, and the stack headers still stripped.
 */
import { mkdtempSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { CertStore } from "../src/certs";
import { HARDENED_HEADERS, PQ_GROUPS, startEdge, type Edge } from "../src/edge";
import { selfSigned } from "./fixtures";

const NAME = "harden.edge.test";
let origin: http.Server;
let edge: Edge;

beforeAll(async () => {
  origin = http.createServer((req, res) => {
    const own =
      req.url === "/own-policy" ? { "content-security-policy": "frame-ancestors 'self'" } : {};
    res.writeHead(200, { "content-type": "text/plain", "x-powered-by": "Express", ...own });
    res.end("ok");
  });
  await new Promise<void>((r) => origin.listen(0, "127.0.0.1", r));
  const certs = new CertStore(mkdtempSync(join(tmpdir(), "harden-")), "k".repeat(40), {
    ecdhCurve: PQ_GROUPS,
    minVersion: "TLSv1.2",
  });
  certs.put(NAME, selfSigned([NAME]));
  edge = await startEdge({
    port: 0,
    host: "127.0.0.1",
    origin: `http://127.0.0.1:${(origin.address() as { port: number }).port}`,
    certs,
    harden: true,
  });
});
afterAll(async () => {
  await edge.close();
  origin.close();
});

function get(path: string): Promise<http.IncomingHttpHeaders> {
  return new Promise((resolve, reject) => {
    https
      .get(
        {
          host: "127.0.0.1",
          port: edge.address().port,
          path,
          servername: NAME,
          headers: { host: NAME },
          rejectUnauthorized: false,
        },
        (res) => {
          res.resume();
          resolve(res.headers);
        },
      )
      .on("error", reject);
  });
}

it("adds every hardened header and strips the stack header", async () => {
  const h = await get("/");
  for (const [k, v] of Object.entries(HARDENED_HEADERS)) expect(h[k]).toBe(v);
  expect(h["x-powered-by"]).toBeUndefined();
});

it("keeps the origin's own value when it sets one", async () => {
  const h = await get("/own-policy");
  expect(h["content-security-policy"]).toBe("frame-ancestors 'self'");
  expect(h["strict-transport-security"]).toBe(HARDENED_HEADERS["strict-transport-security"]);
});
