import "server-only";
import type { SignupRow } from "@/lib/db/repo";
import { live } from "./runtime";
import type { ScanRecord } from "./scan-service";

/** Scan results by host (latest wins), in the database so share links survive restarts. */
export async function saveScan(r: ScanRecord): Promise<void> {
  const { repos } = await live();
  await repos.scans.upsert(r.probe.host.toLowerCase(), JSON.stringify(r), r.scannedAt);
}

export async function latestScan(host: string): Promise<ScanRecord | undefined> {
  const { repos } = await live();
  const row = await repos.scans.get(host.toLowerCase());
  return row ? (JSON.parse(row.result) as ScanRecord) : undefined;
}

export type Signup = SignupRow;

export async function saveSignup(s: Signup): Promise<void> {
  const { repos } = await live();
  await repos.signups.insert(s);
}

export async function listSignups() {
  const { repos } = await live();
  return repos.signups.list();
}
