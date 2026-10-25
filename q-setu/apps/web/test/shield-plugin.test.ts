/**
 * "Shield plugs in" end to end on loopback: the bank behind a classical terminator, then Shield Edge
 * (DNS / container) or the Shield middleware (one line of code), measured for real each time. The
 * report it signs must verify, and one changed byte must not.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

process.env.QSETU_DATA_DIR = mkdtempSync(join(tmpdir(), "plugin-data-"));
const { runPlugin, loadReport, DEMO_DOMAIN } = await import("@/lib/server/shield-plugin");
type Ev = Parameters<Parameters<typeof runPlugin>[1]>[0];

async function run(mode: "dns" | "container" | "code") {
  const events: Ev[] = [];
  expect(await runPlugin(mode, (e) => events.push(e))).toBeUndefined();
  const of = <T extends Ev["t"]>(t: T) =>
    events.filter((e) => e.t === t) as Extract<Ev, { t: T }>[];
  expect(of("error")).toEqual([]);
  return { events, of };
}

it("DNS: the site goes from classical to X25519MLKEM768, hardened, and the score rises", async () => {
  const { events, of } = await run("dns");
  // The beats come in the scene's order.
  const order = events.map((e) => e.t).filter((t, i, a) => a.indexOf(t) === i);
  expect(order).toEqual([
    "start",
    "scan",
    "visit",
    "install",
    "handshake",
    "fix",
    "rescan",
    "report",
    "done",
  ]);
  const before = of("scan")[0]!.before;
  const after = of("rescan")[0]!.after;
  expect(before.group).toBe("X25519");
  expect(before.hybridPq).toBe(false);
  expect(before.checks.hsts.ok).toBe(false);
  expect(before.checks.stack).toMatchObject({ ok: false, seen: "Express" });
  expect(before.checks.tls13.ok).toBe(false);
  expect(of("handshake")[0]).toMatchObject({ group: "X25519MLKEM768", quantumSafe: true });
  expect(after.hybridPq).toBe(true);
  expect(after.protocol).toBe("TLSv1.3");
  for (const id of ["tls13", "hsts", "nosniff", "frame", "referrer", "stack"] as const)
    expect(after.checks[id].ok, id).toBe(true);
  expect(after.checks.csp).toMatchObject({ ok: false, partial: true, seen: "Report-Only" });
  expect(after.score).toBeGreaterThan(before.score);
  // Visitors before Shield were classical; after, quantum-safe.
  expect(of("visit").map((v) => v.quantumSafe)).toEqual([false, false, false, true, true, true]);
});

it("one line of code: defence and headers, but the TLS stays classical", async () => {
  const { of } = await run("code");
  const after = of("rescan")[0]!.after;
  expect(of("handshake")[0]!.quantumSafe).toBe(false);
  expect(after.hybridPq).toBe(false);
  expect(after.checks.hsts.ok).toBe(true);
  expect(after.checks.nosniff.ok).toBe(true);
  expect(after.checks.stack.ok).toBe(true);
  expect(after.checks.tls13.ok).toBe(false);
});

it("the signed report verifies, and a changed byte does not", async () => {
  await run("container");
  const r = loadReport(DEMO_DOMAIN)!;
  expect(r.valid).toBe(true);
  expect(r.signed.alg).toBe("ML-DSA-65");
  expect(r.signed.report.mode).toBe("container");
  const file = join(process.env.QSETU_DATA_DIR!, "verified", `${DEMO_DOMAIN}.json`);
  const doc = JSON.parse(readFileSync(file, "utf8"));
  doc.report.after.score += 1;
  writeFileSync(file, JSON.stringify(doc));
  expect(loadReport(DEMO_DOMAIN)!.valid).toBe(false);
});
