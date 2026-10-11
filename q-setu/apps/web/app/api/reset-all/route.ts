import { SECTOR_IDS } from "@qsetu/sim";
import { getBus, live } from "@/lib/server/runtime";
import { getNetwork } from "@/lib/server/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/reset-all: puts every demo back to a clean start: clears the eavesdropper's recordings
 * in all sectors, restores any ledger rows edited by the tamper demo, and resets the crypto policy.
 * Nothing real is deleted: the ledger keeps every entry it ever wrote.
 */
export async function POST() {
  const { ledger, policy } = await live();
  SECTOR_IDS.forEach((s) => getNetwork(s).reset());
  const restored = await ledger.restore();
  policy.set({ profile: "standard", sig: "ml-dsa-65" });
  getBus().publish({
    op: "POLICY",
    source: "policy",
    alg: "reset",
    ms: 0,
    ok: true,
    detail: "presenter reset: demos back to a clean start",
  });
  return Response.json({ ok: true, restoredLedgerRows: restored });
}
