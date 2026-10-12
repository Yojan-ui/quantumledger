import { fail, parseBody } from "@/lib/server/api";
import { clientKey, RateLimiter } from "@/lib/live/rate-limit";
import { anchorProof, LEAF_LABELS } from "@/lib/live/proof";
import { live } from "@/lib/server/runtime";
import { AnchorBody } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __qsetuAnchorLimit?: RateLimiter };
const limiter = (g.__qsetuAnchorLimit ??= new RateLimiter(30, 60_000));

/**
 * POST /api/proof/anchor { domain, scan, cbomSha3, policy, transcriptSha3 }: hashes the four
 * leaves into a SHA3-256 Merkle tree and appends a signed checkpoint and a signed anchor entry to
 * the Proof Chain. Returns both entries, every tree level and the entries the block chains onto.
 */
export async function POST(req: Request) {
  const wait = limiter.take(clientKey(req));
  if (wait) return fail("rate_limited", `Too many anchors. Try again in ${wait} s.`, 429);
  const b = await parseBody(req, AnchorBody);
  if (!b.ok) return b.res;
  const { ledger } = await live();
  const t = performance.now();
  const r = await anchorProof(ledger, b.data);
  return Response.json({ ...r, labels: LEAF_LABELS, ms: performance.now() - t });
}
