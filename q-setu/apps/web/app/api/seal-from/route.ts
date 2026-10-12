import { ROUTES } from "@/data/routes";
import { fail, parseBody } from "@/lib/server/api";
import { clientKey, RateLimiter } from "@/lib/live/rate-limit";
import { live } from "@/lib/server/runtime";
import { SealFromBody } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __qsetuSealFromLimit?: RateLimiter };
const limiter = (g.__qsetuSealFromLimit ??= new RateLimiter(40, 60_000));

/**
 * POST /api/seal-from { city }: clicking a city on the globe. The live mesh runs one real
 * transaction on a route leaving that city (ML-DSA sign, hybrid-session seal, open, verify) and
 * publishes it on the bus, so the globe flies it like any other packet.
 */
export async function POST(req: Request) {
  const wait = limiter.take(clientKey(req));
  if (wait) return fail("rate_limited", `Too many clicks. Try again in ${wait} s.`, 429);
  const b = await parseBody(req, SealFromBody);
  if (!b.ok) return b.res;
  const routes = ROUTES.map((r, i) => ({ r, i })).filter(
    ({ r }) => r.from === b.data.city || r.to === b.data.city,
  );
  if (!routes.length) return fail("not_found", "No live route from that city", 404);
  const { r, i } = routes[Math.floor(Math.random() * routes.length)]!;
  const { mesh } = await live();
  const t = performance.now();
  mesh.step({ route: i, tamper: false });
  return Response.json({ route: i, from: r.from, to: r.to, ms: performance.now() - t });
}
