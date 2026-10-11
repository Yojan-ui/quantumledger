import { getBus, policyState } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/metrics: rolling 60 s counts and p50/p95 latency per operation, per city and per site. */
export async function GET() {
  return Response.json(getBus().metrics(await policyState()));
}
