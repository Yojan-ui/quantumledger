import { fail, parseBody } from "@/lib/server/api";
import { ensureLedgerSeeded, live } from "@/lib/server/runtime";
import { LedgerTamperBody } from "@/lib/server/schemas";
import { signed } from "@/lib/server/signed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ledger/tamper { id = 42, restore? }: DEMO ONLY. Edits one row directly in SQLite,
 * bypassing the ledger API, the way an insider with database access would. `restore` undoes it.
 */
export const POST = signed(async function POST(req: Request) {
  const b = await parseBody(req, LedgerTamperBody);
  if (!b.ok) return b.res;
  await ensureLedgerSeeded();
  const { ledger } = await live();
  if (b.data.restore) return Response.json({ restored: await ledger.restore() });
  const r = await ledger.tamper(b.data.id);
  if (!r) return fail("not_found", `No ledger entry #${b.data.id}`, 404);
  return Response.json({ tampered: r });
});
