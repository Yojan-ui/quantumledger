import { live } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/ledger/verify: walks the whole chain (hashes, links, ML-DSA signatures) and names the first break. */
export async function POST() {
  const { ledger, bus } = await live();
  const r = await ledger.verify();
  bus.publish({
    op: r.ok ? "VERIFY" : "REJECT",
    source: "ledger",
    alg: "sha3-256 · ml-dsa-65",
    ms: r.ms,
    ok: r.ok,
    detail: r.ok
      ? `chain of ${r.checked} entries intact`
      : `chain broken at #${r.broken!.id}: ${r.broken!.reason}`,
  });
  return Response.json(r);
}
