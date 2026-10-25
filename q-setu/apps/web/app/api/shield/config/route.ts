import { fail } from "@/lib/server/api";
import { siteForKey } from "@/lib/server/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/shield/config (Bearer <site key>): the site's current mode, so dashboard changes reach it. */
export async function GET(req: Request) {
  const site = await siteForKey(req.headers.get("authorization"));
  if (!site) return fail("forbidden", "Unknown site key.", 401);
  return Response.json(
    { mode: site.mode, verified: !!site.verifiedAt },
    { headers: { "cache-control": "no-store" } },
  );
}
