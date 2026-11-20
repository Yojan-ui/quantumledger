import { overviewFor, patternsFor, quantumSafe } from "@/lib/lab/data";
import { withLab } from "@/lib/lab/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/lab/overview[?customer=]: counts, top patterns and % quantum-safe for the scope. */
export async function GET(req: Request) {
  return withLab(req, {}, async ({ scope, customers }) => {
    const inScope = scope.kind === "customer" ? [scope.customer] : customers;
    const [o, patterns, qs] = await Promise.all([
      overviewFor(scope),
      patternsFor(scope),
      quantumSafe(inScope),
    ]);
    return Response.json({
      totals: o.totals,
      topPatterns: patterns
        .slice(0, 5)
        .map(({ id, name, count, lastSeen }) => ({ id, name, count, lastSeen })),
      quantumSafe: qs,
      key: { alg: o.key.alg, keyId: o.key.keyId },
    });
  });
}
