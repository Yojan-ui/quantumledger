import "server-only";
import type { ScanRecord } from "./scan-service";

/** Scan results by host (latest wins). Replaced by the database store in phase B. */
const g = globalThis as unknown as { __qsetuScans?: Map<string, ScanRecord> };
const scans = (g.__qsetuScans ??= new Map());

export async function saveScan(r: ScanRecord): Promise<void> {
  scans.set(r.probe.host, r);
}

export async function latestScan(host: string): Promise<ScanRecord | undefined> {
  return scans.get(host.toLowerCase());
}

export interface Signup {
  kind: "early-access" | "contact";
  name: string;
  email: string;
  organisation: string;
  sector: string;
  useCase: string;
  createdAt: string;
}

const g2 = globalThis as unknown as { __qsetuSignups?: Signup[] };
const signups = (g2.__qsetuSignups ??= []);

export async function saveSignup(s: Signup): Promise<void> {
  signups.push(s);
}

export async function listSignups(): Promise<Signup[]> {
  return [...signups].reverse();
}
