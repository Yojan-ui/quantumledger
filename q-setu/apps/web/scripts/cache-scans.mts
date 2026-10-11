/**
 * Pre-caches real URL scans of well-known Indian sites into data/scan-cache.json, so the home-page
 * scan works offline. Every entry is a real probe made at `scannedAt`; the UI labels it as cached.
 *   pnpm --filter @qsetu/web exec tsx scripts/cache-scans.mts
 */
import { writeFileSync } from "node:fs";
import { scan } from "@qsetu/core";
import { explain } from "../lib/live/explain";
import { locate } from "../lib/live/geo";
import { buildPlan } from "../lib/live/plan";
import { probeTls } from "../lib/live/tls";

const HOSTS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "onlinesbi.sbi",
      "www.hdfcbank.com",
      "www.icicibank.com",
      "www.irctc.co.in",
      "www.digilocker.gov.in",
      "www.npci.org.in",
      "www.axisbank.com",
    ];

const out: Record<string, unknown> = {};
for (const h of HOSTS) {
  try {
    const probe = await probeTls(h);
    const result = scan(probe.report, probe.host);
    const geo = await locate(probe.address);
    out[probe.host] = {
      probe,
      score: result.score,
      grade: result.grade,
      summary: result.summary,
      findings: result.findings,
      cbom: result.cbom,
      plan: buildPlan({
        findings: result.findings,
        dataLifetimeYears: 10,
        source: "url",
        hybridPq: probe.hybridPq,
      }),
      plain: explain(probe, result.findings),
      geo,
      scannedAt: new Date().toISOString(),
    };
    console.log(
      "✓",
      probe.host,
      probe.protocol,
      probe.group,
      probe.certKey,
      result.score,
      geo.label,
    );
  } catch (e) {
    console.log("✗", h, (e as Error).message);
  }
}
writeFileSync(
  new URL("../data/scan-cache.json", import.meta.url),
  JSON.stringify(out, null, 2) + "\n",
);
