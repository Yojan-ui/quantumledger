import { parseQuery } from "@/lib/server/api";
import { ensureLedgerSeeded, live } from "@/lib/server/runtime";
import { LedgerQuery } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ledger?limit=50[&around=42]: the newest entries (newest first), or a window around one ID (oldest first). */
export async function GET(req: Request) {
  const q = parseQuery(req, LedgerQuery);
  if (!q.ok) return q.res;
  await ensureLedgerSeeded();
  const { ledger } = await live();
  const { limit, around } = q.data;
  const entries =
    around === undefined
      ? await ledger.recent(limit)
      : await ledger.range(
          Math.max(1, around - Math.floor(limit / 2)),
          around + Math.ceil(limit / 2) - 1,
        );
  return Response.json({ count: await ledger.count(), tampered: await ledger.tampered(), entries });
}
