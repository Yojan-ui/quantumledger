import "server-only";
import { hostFromInput } from "@/lib/live/tls";
import { cachedScan, type ScanRecord } from "./scan-service";
import { latestScan } from "./store";

/** The newest stored scan for a host, else the pre-cached one, else nothing. Never probes. */
export async function storedScan(raw: string): Promise<ScanRecord | undefined> {
  let host: string;
  try {
    host = hostFromInput(decodeURIComponent(raw));
  } catch {
    return undefined;
  }
  const rec = (await latestScan(host).catch(() => undefined)) ?? cachedScan(host);
  return rec && rebrand(rec);
}

/**
 * Scans stored before the rename carry the old product names in their findings and CBOM text.
 * The measurements are unchanged; only the wording is brought up to date when a record is read.
 */
function rebrand(rec: ScanRecord): ScanRecord {
  const json = JSON.stringify(rec);
  if (!json.includes("Q-Setu") && !json.includes("Q-Ledger")) return rec;
  return JSON.parse(
    json.replaceAll("Q-Setu", "QuantumLedger").replaceAll("Q-Ledger", "Proof Chain"),
  ) as ScanRecord;
}
