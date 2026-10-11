import { parseBody } from "@/lib/server/api";
import { live, policyState } from "@/lib/server/runtime";
import { PolicyBody } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/policy: the active crypto policy and how many live links have re-keyed onto it. */
export function GET() {
  return Response.json(policyState());
}

/**
 * POST /api/policy { profile?, sig? }: hot-swaps the profile (standard ↔ edge) and/or the transaction
 * signature algorithm (ML-DSA-65, ML-DSA-44, SLH-DSA). Nothing restarts; each live session re-keys
 * onto the new policy at its next rotation.
 */
export async function POST(req: Request) {
  const b = await parseBody(req, PolicyBody);
  if (!b.ok) return b.res;
  live().policy.set(b.data);
  return Response.json(policyState());
}
