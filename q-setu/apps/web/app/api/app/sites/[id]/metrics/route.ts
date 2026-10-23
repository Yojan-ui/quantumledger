import { fail, parseParams } from "@/lib/server/api";
import { requireFull } from "@/lib/server/app-route";
import { live } from "@/lib/server/runtime";
import { IdParams } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/app/sites/{id}/metrics: the last 30 days, totals with % quantum-safe, and recent events. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireFull();
  if (!a.ok) return a.res;
  const p = parseParams(await ctx.params, IdParams);
  if (!p.ok) return p.res;
  const { repos } = await live();
  const site = await repos.sites.owned(a.account.id, p.data.id);
  if (!site) return fail("not_found", "No such site.", 404);
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  const days = await repos.shieldStats.range(site.id, from, to);
  const sum = (k: "pq" | "classical" | "requests" | "challenged" | "blocked") =>
    days.reduce((n, d) => n + Number(d[k]), 0);
  const tls = sum("pq") + sum("classical");
  const events = (await repos.shieldEvents.recent(site.id, 50)).map((e) => ({
    at: e.at,
    type: e.type,
    score: e.score,
    ...JSON.parse(e.detail),
  }));
  return Response.json({
    days,
    totals: {
      requests: sum("requests"),
      challenged: sum("challenged"),
      blocked: sum("blocked"),
      tlsConnections: tls,
      // Only Shield Edge sees the TLS handshake; with the middleware alone this stays null.
      pqShare: tls ? sum("pq") / tls : null,
    },
    events,
  });
}
