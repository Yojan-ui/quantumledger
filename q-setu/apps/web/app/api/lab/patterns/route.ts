import { patternsFor } from "@/lib/lab/data";
import { withLab } from "@/lib/lab/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/lab/patterns[?customer=]: named patterns with counts and last-seen, in scope. */
export async function GET(req: Request) {
  return withLab(req, {}, async ({ scope }) =>
    Response.json({ patterns: await patternsFor(scope) }),
  );
}
