/**
 * Tunnel benchmark: the same request to the legacy bank app four ways, on loopback.
 *
 *   direct  plain HTTP to the origin (the floor)
 *   https   TLS 1.3 with X25519MLKEM768 through Shield Edge (native OpenSSL)
 *   v1      the JSON tunnel (one POST per request, base64 bodies, pure-JS AES-GCM)
 *   v2      the binary tunnel (one HTTP/2 connection, streamed frames, native AES-GCM)
 *
 * For each: per-request latency on a warm connection (p50/p95 of 2,000 sequential GETs) and the time
 * to send a 10 MB body and get the reply. Writes bench/tunnel-results.json.
 *
 *   pnpm --filter @qsetu/shield-proxy bench:tunnel
 */
import { writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { fileURLToPath } from "node:url";
import { bytesToBase64, createIdentity } from "@qsetu/core";
import { createLegacyApp } from "../../../apps/legacy-bank/src/app";
import { CertStore } from "../../shield-edge/src/certs";
import { PQ_GROUPS, startEdge } from "../../shield-edge/src/edge";
import { selfSigned } from "../../shield-edge/test/fixtures";
import { startShieldClient, startShieldServer, startTunnelClient, startTunnelServer } from "../src";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const here = fileURLToPath(new URL(".", import.meta.url));
const N = process.argv.includes("--quick") ? 300 : 2000;
const pct = (xs: number[], p: number) =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))]!;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

const listen = (app: http.RequestListener) =>
  new Promise<number>((r) => {
    const s = http
      .createServer(app)
      .listen(0, "127.0.0.1", () => r((s.address() as { port: number }).port));
  });

async function main() {
  // The origin: the legacy bank, plus an /upload route that counts the body.
  const bank = createLegacyApp(() => {}) as unknown as http.RequestListener;
  const originPort = await listen((req, res) => {
    if (req.method !== "POST" || req.url !== "/upload") return bank(req, res);
    let n = 0;
    req.on("data", (c: Buffer) => (n += c.length));
    req.on("end", () => res.end(JSON.stringify({ n })));
  });
  const origin = `http://127.0.0.1:${originPort}`;

  const certs = new CertStore(mkdtempSync(join(tmpdir(), "tb-")), "t".repeat(40), {
    ecdhCurve: PQ_GROUPS,
    minVersion: "TLSv1.2",
  });
  const pair = selfSigned(["bank.bench.test"]);
  certs.put("bank.bench.test", pair);
  const edge = await startEdge({ port: 0, host: "127.0.0.1", origin, certs, fallbackCert: pair });

  const identity = createIdentity("standard");
  const quiet = () => {};
  const s1 = await startShieldServer({ upstream: origin, listen: 0, identity, log: quiet });
  const s1port = (s1.app.server.address() as { port: number }).port;
  const c1 = await startShieldClient({
    peer: `http://127.0.0.1:${s1port}`,
    listen: 0,
    serverKey: bytesToBase64(identity.publicKey),
    log: quiet,
  });
  const c1port = (c1.app.server.address() as { port: number }).port;
  const s2 = await startTunnelServer({ upstream: origin, listen: 0, identity, log: quiet });
  const c2 = await startTunnelClient({
    peer: `http://127.0.0.1:${s2.port()}`,
    listen: 0,
    serverKey: bytesToBase64(identity.publicKey),
    log: quiet,
  });

  const routes = {
    direct: { secure: false, port: originPort },
    https: { secure: true, port: edge.address().port },
    v1: { secure: false, port: c1port },
    v2: { secure: false, port: c2.port() },
  } as const;

  const results: Record<string, unknown> = {
    when: new Date().toISOString(),
    node: process.version,
    openssl: process.versions.openssl,
    requests: N,
  };
  for (const [name, r] of Object.entries(routes)) {
    const agent = r.secure
      ? new https.Agent({ keepAlive: true, maxSockets: 1 })
      : new http.Agent({ keepAlive: true, maxSockets: 1 });
    const call = (method: string, path: string, body?: Buffer) =>
      new Promise<number>((resolve, reject) => {
        const t = process.hrtime.bigint();
        const req = (r.secure ? https : http).request(
          {
            host: "127.0.0.1",
            port: r.port,
            method,
            path,
            agent,
            headers: {
              host: "bank.bench.test",
              ...(body
                ? { "content-type": "application/octet-stream", "content-length": body.length }
                : {}),
            },
            ...(r.secure ? { servername: "bank.bench.test", rejectUnauthorized: false } : {}),
          },
          (res) => {
            res.resume();
            res.on("end", () => resolve(Number(process.hrtime.bigint() - t) / 1e6));
          },
        );
        req.on("error", reject);
        req.end(body);
      });
    for (let i = 0; i < 100; i++) await call("GET", "/api/health");
    const lat: number[] = [];
    for (let i = 0; i < N; i++) lat.push(await call("GET", "/api/health"));
    const big = Buffer.alloc(10 * 1024 * 1024, 7);
    let upload: number | string;
    try {
      upload = r3(await call("POST", "/upload", big));
    } catch (e) {
      upload = `failed: ${(e as Error).message}`;
    }
    results[name] = { p50: r3(pct(lat, 50)), p95: r3(pct(lat, 95)), upload10MBms: upload };
    agent.destroy();
  }
  writeFileSync(`${here}tunnel-results.json`, JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // loopback, self-signed test certificate, benchmark only
void main();
