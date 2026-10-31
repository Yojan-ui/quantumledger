#!/usr/bin/env node
/**
 * Latency of the read and validate endpoints of /api/lab against a running server.
 *   node tools/bench_lab_api.mjs [--base http://127.0.0.1:3000] [--n 200]
 * Creates a workspace and one Sample data run (real scanner, real ledger append), then times each
 * endpoint sequentially after 10 warm-up calls. Prints p50/p95/max in ms per endpoint as JSON.
 */
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const BASE = arg("--base", "http://127.0.0.1:3000");
const N = Number(arg("--n", "200"));
const call = async (path, body) => {
  const r = await fetch(
    BASE + path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const text = await r.text();
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
};
const ws = (await call("/api/lab/workspaces", {})).id;
const sample = (await call("/api/lab/samples")).samples[0].id;
const spec = { inputs: [{ kind: "sample", id: sample }], dataLifetimeYears: 10, workspace: ws };
const { runId } = await call("/api/lab/runs", spec);
for (let i = 0; i < 100; i++) {
  const r = await call(`/api/lab/runs/${runId}`);
  if (["done", "failed", "cancelled"].includes(r.status)) break;
  await new Promise((s) => setTimeout(s, 50));
}

const endpoints = [
  ["GET health", () => call("/api/lab/health")],
  ["GET samples", () => call("/api/lab/samples")],
  ["GET workspace", () => call(`/api/lab/workspaces/${ws}`)],
  ["GET run", () => call(`/api/lab/runs/${runId}`)],
  ["GET result", () => call(`/api/lab/runs/${runId}/result`)],
  ["POST validate", () => call("/api/lab/validate", spec)],
];
const q = (a, p) => a[Math.min(a.length - 1, Math.ceil(p * a.length) - 1)];
const out = {};
let all = [];
for (const [name, fn] of endpoints) {
  for (let i = 0; i < 10; i++) await fn();
  const t = [];
  for (let i = 0; i < N; i++) {
    const s = performance.now();
    await fn();
    t.push(performance.now() - s);
  }
  t.sort((a, b) => a - b);
  all = all.concat(t);
  out[name] = {
    p50: +q(t, 0.5).toFixed(2),
    p95: +q(t, 0.95).toFixed(2),
    max: +t[t.length - 1].toFixed(2),
  };
}
all.sort((a, b) => a - b);
console.log(
  JSON.stringify(
    {
      base: BASE,
      n: N,
      runId,
      endpoints: out,
      overall: {
        p50: +q(all, 0.5).toFixed(2),
        p95: +q(all, 0.95).toFixed(2),
        max: +all[all.length - 1].toFixed(2),
      },
    },
    null,
    1,
  ),
);
