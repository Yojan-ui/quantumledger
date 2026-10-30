import "server-only";
import { scan, type Finding } from "@qsetu/core";
import CACHE from "@/data/scan-cache.json";
import { explain } from "@/lib/live/explain";
import { locate, type GeoPoint } from "@/lib/live/geo";
import { buildPlan, planToMarkdown, type Plan } from "@/lib/live/plan";
import { hostFromInput, probeTls, type TlsProbe } from "@/lib/live/tls";
import { isOffline } from "./env";
import { saveScan } from "./store";

export interface ScanRecord {
  probe: TlsProbe;
  score: number;
  grade: string;
  summary: Record<string, number>;
  findings: Finding[];
  cbom: unknown;
  plan: Plan & { markdown: string };
  /** Up to three plain-language findings for non-specialists. */
  plain: string[];
  geo: GeoPoint;
  scannedAt: string;
  /** Set when this came from the pre-cached scans (offline, or the live probe failed). */
  cached?: boolean;
}

/** Sites pre-scanned for offline demos, offered as one-click suggestions. */
export const SUGGESTED = [
  "onlinesbi.sbi",
  "www.hdfcbank.com",
  "www.icicibank.com",
  "www.npci.org.in",
  "www.axisbank.com",
];

const cache = CACHE as unknown as Record<string, Omit<ScanRecord, "cached"> & { plan: Plan }>;

export function cachedScan(host: string): ScanRecord | undefined {
  const h = host.toLowerCase();
  const hit = cache[h] ?? cache[`www.${h}`] ?? cache[h.replace(/^www\./, "")];
  if (!hit) return undefined;
  return {
    ...hit,
    plan: {
      ...hit.plan,
      markdown: planToMarkdown(hit.plan, `Migration plan for ${hit.probe.host}`),
    },
    cached: true,
  };
}

/**
 * Probes a public host for real and returns the full record. Offline (NEXT_PUBLIC_OFFLINE=1), or when
 * the network fails, it falls back to a pre-cached real scan if there is one, labelled `cached`.
 */
export async function scanHost(input: string): Promise<ScanRecord> {
  const host = hostFromInput(input);
  if (isOffline()) {
    const c = cachedScan(host);
    if (c) return c;
    throw new Error(`Offline mode: no cached scan for ${host}. Try one of the suggested sites.`);
  }
  let probe: TlsProbe;
  try {
    probe = await probeTls(host);
  } catch (e) {
    const c = cachedScan(host);
    if (c) return c;
    throw e;
  }
  const result = scan(probe.report, probe.host);
  const plan = buildPlan({
    findings: result.findings,
    dataLifetimeYears: 10,
    source: "url",
    hybridPq: probe.hybridPq,
  });
  const rec: ScanRecord = {
    probe,
    score: result.score,
    grade: result.grade,
    summary: result.summary,
    findings: result.findings,
    cbom: result.cbom,
    plan: { ...plan, markdown: planToMarkdown(plan, `Migration plan for ${probe.host}`) },
    plain: explain(probe, result.findings),
    geo: await locate(probe.address),
    scannedAt: new Date().toISOString(),
  };
  await saveScan(rec).catch(() => {});
  return rec;
}
