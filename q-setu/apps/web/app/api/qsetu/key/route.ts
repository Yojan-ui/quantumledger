import { publicKeysOf } from "@qsetu/web-shield";
import { getWebShieldKeys } from "@/lib/server/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/qsetu/key: the Web shield's public keys. Pages pin `kid` via data-key. */
export function GET() {
  return Response.json(publicKeysOf(getWebShieldKeys()));
}
