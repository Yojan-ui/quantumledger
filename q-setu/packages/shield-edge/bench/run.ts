/**
 * Shield Edge benchmark against the budget (exits 1 if any budget is missed):
 *
 *   1. Added latency on warm connections: p50 ≤ 2 ms, p95 ≤ 10 ms (edge vs the bare origin).
 *   2. Added latency with TLS session resumption (a new connection each request, resumed): reported.
 *   3. Extra server CPU for a full post-quantum handshake vs X25519 alone: ≤ 1.5 ms.
 *   4. The edge's own CPU at a steady 1,000 req/s (autocannon): ≤ 10% of one core.
 *   5. Memory per idle TLS connection: reported.
 *
 * Origin: the legacy bank app (apps/legacy-bank), in its own process. Edge: Shield Edge, in its own
 * process. Everything on loopback, so the numbers are the edge's processing cost, not the network.
 *
 *   pnpm --filter @qsetu/shield-edge bench          (writes bench/results.json)
 */
import { fork, type ChildProcess } from "node:child_process";
import { writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { cpus } from "node:os";
import tls from "node:tls";
import { fileURLToPath } from "node:url";
import autocannon from "autocannon";

const NAME = "bank.bench.test";
const ORIGIN_PORT = 47100;
const EDGE_PORT = 47443;
const here = fileURLToPath(new URL(".", import.meta.url));
const quick = process.argv.includes("--quick");

function start(args: string[]): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const c = fork(`${here}procs.ts`, args, {
      execArgv: ["--import", "tsx"],
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    });
    c.once("message", (m) => (m === "ready" ? resolve(c) : reject(new Error(String(m)))));
    c.once("error", reject);
  });
}
type Stats = { cpu: NodeJS.CpuUsage; rss: number; metrics?: Record<string, unknown> };
const stats = (c: ChildProcess) =>
  new Promise<Stats>((resolve) => {
    c.once("message", (m) => resolve(m as Stats));
    c.send("stats");
  });
const cpuMs = (a: NodeJS.CpuUsage, b: NodeJS.CpuUsage) =>
  (b.user - a.user + (b.system - a.system)) / 1000;

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
};
const r3 = (n: number) => Math.round(n * 1000) / 1000;

function timed(fn: () => Promise<void>): Promise<number> {
  const t = process.hrtime.bigint();
  return fn().then(() => Number(process.hrtime.bigint() - t) / 1e6);
}

function getVia(
  agent: http.Agent | https.Agent,
  secure: boolean,
  path = "/api/health",
): Promise<void> {
  return new Promise((resolve, reject) => {
    const mod = secure ? https : http;
    const req = mod.request(
      {
        host: "127.0.0.1",
        port: secure ? EDGE_PORT : ORIGIN_PORT,
        path,
        agent,
        ...(secure ? { servername: NAME, rejectUnauthorized: false, headers: { host: NAME } } : {}),
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve());
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/** One TLS handshake (fresh or resumed) with the given client groups; resolves the session. */
function handshake(
  groups: string,
  session?: Buffer,
): Promise<{ session?: Buffer; reused: boolean; group?: string }> {
  return new Promise((resolve, reject) => {
    let saved: Buffer | undefined;
    const c = tls.connect(
      {
        host: "127.0.0.1",
        port: EDGE_PORT,
        servername: NAME,
        rejectUnauthorized: false,
        ecdhCurve: groups,
        ...(session ? { session } : {}),
      },
      () => {
        const group = (c.getEphemeralKeyInfo() as { name?: string } | null)?.name;
        c.write(`GET /api/health HTTP/1.1\r\nHost: ${NAME}\r\nConnection: close\r\n\r\n`);
        c.on("end", () =>
          resolve({
            ...(saved ? { session: saved } : {}),
            reused: c.isSessionReused(),
            ...(group ? { group } : {}),
          }),
        );
      },
    );
    c.on("session", (s) => (saved = s));
    c.on("data", () => {});
    c.on("error", reject);
  });
}

async function main() {
  const origin = await start(["origin", String(ORIGIN_PORT)]);
  const edge = await start(["edge", String(EDGE_PORT), `http://127.0.0.1:${ORIGIN_PORT}`]);
  const results: Record<string, unknown> = {
    when: new Date().toISOString(),
    node: process.version,
    openssl: process.versions.openssl,
    cpu: cpus()[0]?.model,
    platform: `${process.platform}/${process.arch}`,
  };
  const failures: string[] = [];

  // 1. Warm connections, one request at a time, bare and edge interleaved.
  {
    const bareAgent = new http.Agent({ keepAlive: true, maxSockets: 1 });
    const edgeAgent = new https.Agent({ keepAlive: true, maxSockets: 1 });
    const n = quick ? 500 : 3000;
    for (let i = 0; i < 300; i++)
      await Promise.all([getVia(bareAgent, false), getVia(edgeAgent, true)]);
    const bare: number[] = [];
    const via: number[] = [];
    for (let i = 0; i < n; i++) {
      bare.push(await timed(() => getVia(bareAgent, false)));
      via.push(await timed(() => getVia(edgeAgent, true)));
    }
    const added = {
      p50: r3(pct(via, 50) - pct(bare, 50)),
      p95: r3(pct(via, 95) - pct(bare, 95)),
      p99: r3(pct(via, 99) - pct(bare, 99)),
    };
    results.warm = {
      requests: n,
      bare: { p50: r3(pct(bare, 50)), p95: r3(pct(bare, 95)) },
      edge: { p50: r3(pct(via, 50)), p95: r3(pct(via, 95)) },
      added,
    };
    if (added.p50 > 2) failures.push(`warm p50 added ${added.p50} ms > 2 ms`);
    if (added.p95 > 10) failures.push(`warm p95 added ${added.p95} ms > 10 ms`);
    bareAgent.destroy();
    edgeAgent.destroy();
  }

  // 2. A new connection per request, resuming the TLS session (what a returning visitor does).
  {
    const n = quick ? 200 : 1000;
    let { session } = await handshake("X25519MLKEM768:X25519");
    const times: number[] = [];
    let reused = 0;
    for (let i = 0; i < n; i++) {
      const t = await timed(async () => {
        const r = await handshake("X25519MLKEM768:X25519", session);
        if (r.reused) reused++;
        if (r.session) session = r.session;
      });
      times.push(t);
    }
    results.resumed = {
      connections: n,
      reusedShare: r3(reused / n),
      p50: r3(pct(times, 50)),
      p95: r3(pct(times, 95)),
    };
  }

  // 3. Full handshakes: the edge process's own CPU per handshake, PQ hybrid vs X25519 only.
  {
    // Alternating blocks of each kind, after a warm-up of both, so JIT warm-up and drift hit both.
    const n = quick ? 400 : 2000;
    const block = 100;
    const acc = { X25519: { ms: 0, n: 0, group: "" }, X25519MLKEM768: { ms: 0, n: 0, group: "" } };
    for (let i = 0; i < 200; i++) await handshake(i % 2 ? "X25519" : "X25519MLKEM768");
    for (let done = 0; done < n; done += block)
      for (const groups of ["X25519", "X25519MLKEM768"] as const) {
        const a = (await stats(edge)).cpu;
        for (let i = 0; i < block; i++) acc[groups].group = (await handshake(groups)).group ?? "";
        const b = (await stats(edge)).cpu;
        acc[groups].ms += cpuMs(a, b);
        acc[groups].n += block;
      }
    const classical = { msPerHandshake: acc.X25519.ms / acc.X25519.n, group: acc.X25519.group };
    const pq = {
      msPerHandshake: acc.X25519MLKEM768.ms / acc.X25519MLKEM768.n,
      group: acc.X25519MLKEM768.group,
    };
    const extra = r3(pq.msPerHandshake - classical.msPerHandshake);
    results.handshake = {
      handshakes: n,
      note: "Edge-process CPU per full handshake (TLS 1.3, ECDSA P-256 certificate), including one small request.",
      x25519: { group: classical.group, cpuMs: r3(classical.msPerHandshake) },
      x25519mlkem768: { group: pq.group, cpuMs: r3(pq.msPerHandshake) },
      extraCpuMs: extra,
    };
    if (pq.group !== "X25519MLKEM768") failures.push(`PQ client negotiated ${pq.group}`);
    if (extra > 1.5) failures.push(`PQ handshake extra CPU ${extra} ms > 1.5 ms`);
  }

  // 4. Steady 1,000 req/s for 20 s (autocannon): first straight to the origin, then through the edge.
  {
    const duration = quick ? 8 : 20;
    const bare = await autocannon({
      url: `http://127.0.0.1:${ORIGIN_PORT}/api/health`,
      connections: 50,
      overallRate: 1000,
      duration,
    });
    const a = (await stats(edge)).cpu;
    const t = process.hrtime.bigint();
    const r = await autocannon({
      url: `https://127.0.0.1:${EDGE_PORT}/api/health`,
      headers: { host: NAME },
      connections: 50,
      overallRate: 1000,
      duration,
    });
    const wallMs = Number(process.hrtime.bigint() - t) / 1e6;
    const b = (await stats(edge)).cpu;
    const share = cpuMs(a, b) / wallMs;
    results.load = {
      tool: "autocannon",
      targetRps: 1000,
      achievedRps: Math.round(r.requests.average),
      seconds: duration,
      errors: r.errors + r.non2xx,
      latencyMs: { p50: r.latency.p50, p97_5: r.latency.p97_5, p99: r.latency.p99 },
      bareLatencyMs: { p50: bare.latency.p50, p97_5: bare.latency.p97_5, p99: bare.latency.p99 },
      note: "autocannon reports latency in whole milliseconds; the warm-connection test above has the sub-millisecond view.",
      edgeCpuShareOfOneCore: r3(share),
    };
    if (share > 0.1)
      failures.push(`edge CPU at 1,000 req/s ${Math.round(share * 100)}% of a core > 10%`);
    if (r.errors + r.non2xx > 0) failures.push(`${r.errors + r.non2xx} errors under load`);
  }

  // 5. Idle connections: memory per open TLS connection on the edge.
  {
    const n = quick ? 200 : 1000;
    global.gc?.();
    const before = (await stats(edge)).rss;
    const socks: tls.TLSSocket[] = [];
    for (let i = 0; i < n; i++)
      socks.push(
        await new Promise<tls.TLSSocket>((resolve, reject) => {
          const s = tls.connect(
            { host: "127.0.0.1", port: EDGE_PORT, servername: NAME, rejectUnauthorized: false },
            () => resolve(s),
          );
          s.on("error", reject);
        }),
      );
    await new Promise((r) => setTimeout(r, 1000));
    const after = (await stats(edge)).rss;
    results.idle = { connections: n, rssPerConnectionKiB: Math.round((after - before) / n / 1024) };
    for (const s of socks) s.destroy();
  }

  results.edgeMetrics = (await stats(edge)).metrics;
  results.failures = failures;
  writeFileSync(`${here}results.json`, JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results, null, 2));
  origin.kill();
  edge.kill();
  if (failures.length) {
    console.error(`\nBUDGET MISSED:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
  console.log("\nAll budgets met.");
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // loopback, self-signed test certificate, benchmark only
void main();
