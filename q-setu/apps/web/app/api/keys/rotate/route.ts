import { fail, parseBody } from "@/lib/server/api";
import { live } from "@/lib/server/runtime";
import { KeysRotateBody } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/keys/rotate { purpose }: rotates a key now (it also rotates on a schedule). Logged to the Q-Ledger. */
export async function POST(req: Request) {
  const b = await parseBody(req, KeysRotateBody);
  if (!b.ok) return b.res;
  const k = live().keys.rotate(b.data.purpose);
  if (!k) return fail("not_found", `No active ${b.data.purpose} key yet`, 404);
  return Response.json({ active: k.meta });
}
