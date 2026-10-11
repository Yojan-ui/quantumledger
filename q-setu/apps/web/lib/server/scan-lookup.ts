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
  return (await latestScan(host).catch(() => undefined)) ?? cachedScan(host);
}
