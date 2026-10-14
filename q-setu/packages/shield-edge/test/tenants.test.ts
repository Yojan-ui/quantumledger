/**
 * Tenant isolation on one edge: two sites, two origins, two certificates. Each visitor gets the
 * certificate and the origin of the name they asked for, and nothing else.
 */
import http from "node:http";
import https from "node:https";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TLSSocket } from "node:tls";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CertStore } from "../src/certs";
import { type Edge, PQ_GROUPS, startEdge } from "../src/edge";
import { selfSigned } from "./fixtures";

const A = "alpha.tenant.test";
const B = "beta.tenant.test";
let edge: Edge;
const origins: http.Server[] = [];
const hits = { a: 0, b: 0 };

async function origin(tag: "a" | "b") {
  const s = http.createServer((_req, res) => {
    hits[tag]++;
    res.end(`origin ${tag}`);
  });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  origins.push(s);
  return `http://127.0.0.1:${(s.address() as { port: number }).port}`;
}

beforeAll(async () => {
  const certs = new CertStore(mkdtempSync(join(tmpdir(), "tenants-")), "t".repeat(40), {
    ecdhCurve: PQ_GROUPS,
    minVersion: "TLSv1.2",
  });
  certs.put(A, selfSigned([A]));
  certs.put(B, selfSigned([B]));
  edge = await startEdge({
    port: 0,
    host: "127.0.0.1",
    origin: "http://127.0.0.1:1", // never used when routes are set
    routes: { [A]: await origin("a"), [B]: await origin("b") },
    certs,
  });
});
afterAll(async () => {
  await edge.close();
  origins.forEach((o) => o.close());
});

function ask(sni: string, host: string) {
  return new Promise<{ status: number; body: string; cn?: string }>((resolve, reject) => {
    const req = https.request(
      {
        host: "127.0.0.1",
        port: edge.address().port,
        servername: sni,
        rejectUnauthorized: false,
        agent: false,
        headers: { host },
      },
      (res) => {
        const cn = (res.socket as TLSSocket).getPeerCertificate().subject?.CN;
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () =>
          resolve({ status: res.statusCode!, body, ...(cn ? { cn: String(cn) } : {}) }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("tenant isolation", () => {
  it("serves each site its own certificate and origin", async () => {
    const a = await ask(A, A);
    const b = await ask(B, B);
    expect([a.status, a.body, a.cn]).toEqual([200, "origin a", A]);
    expect([b.status, b.body, b.cn]).toEqual([200, "origin b", B]);
  });

  it("refuses a request whose Host names another tenant (domain fronting), before any origin sees it", async () => {
    const before = { ...hits };
    const r = await ask(A, B);
    expect(r.status).toBe(421);
    expect(r.cn).toBe(A); // the TLS side stayed with tenant A
    expect(hits).toEqual(before);
  });

  it("refuses names it doesn't serve", async () => {
    const before = { ...hits };
    await expect(ask("gamma.tenant.test", "gamma.tenant.test")).rejects.toThrow();
    expect(hits).toEqual(before);
  });
});
