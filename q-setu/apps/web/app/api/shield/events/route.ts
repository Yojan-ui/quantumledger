import { fail, parseBody } from "@/lib/server/api";
import { ingest, siteForKey } from "@/lib/server/dashboard";
import { ShieldEventsBody } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/shield/events (Authorization: Bearer <site key>): batches of events and counters from
 * Shield Edge and the @qsetu/shield middleware. Server to server: authenticated by the site key, not
 * by the browser session.
 */
export async function POST(req: Request) {
  const site = await siteForKey(req.headers.get("authorization"));
  if (!site) return fail("forbidden", "Unknown site key.", 401);
  const b = await parseBody(req, ShieldEventsBody);
  if (!b.ok) return b.res;
  await ingest(site, b.data.events, b.data.stats);
  return Response.json({ ok: true, mode: site.mode });
}
