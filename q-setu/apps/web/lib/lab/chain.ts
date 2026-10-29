/**
 * Compact Proof Chain listing for the Lab's chain column: one row per entry (newest CHAIN_CAP), no payloads
 * except the run id of lab-run entries so a slab can link to its run. Read-only; verify stays on
 * POST /api/ledger/verify.
 */
import type { LedgerEntry } from "@/lib/live/ledger";

export const CHAIN_CAP = 4000;

export function chainRow(e: LedgerEntry) {
  const runId =
    e.kind === "lab-run" && typeof e.payload.runId === "string" ? e.payload.runId : null;
  return {
    id: e.id,
    at: e.at,
    kind: e.kind,
    subject: e.subject.slice(0, 140),
    hash: e.hash,
    runId,
  };
}

export function chainEtag(count: number, head: string | null, tampered: number[]) {
  return `"chain-${count}-${head ?? "none"}-${tampered.join(".")}"`;
}
