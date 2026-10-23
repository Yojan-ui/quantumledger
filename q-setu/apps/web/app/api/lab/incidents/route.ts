import { overviewFor } from "@/lib/lab/data";
import { withLab } from "@/lib/lab/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/lab/incidents[?customer=]: the incidents in the signed-in scope, newest first. */
export async function GET(req: Request) {
  return withLab(req, {}, async ({ scope }) =>
    Response.json({ incidents: (await overviewFor(scope)).incidents }),
  );
}
