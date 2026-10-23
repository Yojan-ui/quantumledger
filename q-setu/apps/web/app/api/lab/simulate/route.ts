import { engine } from "@/lib/lab/engine";
import { withLab } from "@/lib/lab/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/lab/simulate (team only): asks the engine to send its labelled test traffic to its own
 * protected sandbox on loopback, dealt across the demo customers' sites.
 */
export async function POST(req: Request) {
  return withLab(req, { team: true }, async () =>
    Response.json(await engine("/api/simulate", { method: "POST", body: "{}" }), { status: 202 }),
  );
}
