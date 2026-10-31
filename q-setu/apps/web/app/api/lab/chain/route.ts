import { CHAIN_CAP, chainEtag, chainRow } from "@/lib/lab/chain";
import { ensureLedgerSeeded, live } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/lab/chain: every Proof Chain entry (newest CHAIN_CAP, oldest first) as compact rows, the count,
 * the head and the ids of tampered entries. Seeds the demo chain exactly like GET /api/ledger does.
 * ETag changes with the count, the head hash and the tampered set; If-None-Match answers 304.
 */
export async function GET(req: Request) {
  await ensureLedgerSeeded();
  const { ledger } = await live();
  const count = await ledger.count();
  const tampered = await ledger.tampered();
  const from = Math.max(1, count - CHAIN_CAP + 1);
  const entries = count ? await ledger.range(from, count) : [];
  const head = entries.at(-1) ?? null;
  const etag = chainEtag(count, head?.hash ?? null, tampered);
  const headers = { ETag: etag, "Cache-Control": "private, no-cache" };
  if (req.headers.get("if-none-match") === etag)
    return new Response(null, { status: 304, headers });
  return Response.json(
    {
      count,
      from,
      truncated: from > 1,
      head: head && { id: head.id, hash: head.hash },
      tampered,
      entries: entries.map(chainRow),
    },
    { headers },
  );
}
