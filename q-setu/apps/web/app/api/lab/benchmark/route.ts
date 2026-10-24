import { engine } from "@/lib/lab/engine";
import { withLab } from "@/lib/lab/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/lab/benchmark (team only): runs the resilience benchmark. The engine runs the Lab's
 * attacker agents against its own fresh loopback sandbox pair (bare, and behind PQC + Shield) and
 * refuses any non-loopback target; the browser never sends attack traffic anywhere.
 */
export async function POST(req: Request) {
  return withLab(req, { team: true }, async () =>
    Response.json(await engine<{ id: string }>("/api/benchmark", { method: "POST", body: "{}" }), {
      status: 202,
    }),
  );
}

/** GET /api/lab/benchmark (team only): the running benchmark's progress and/or the last report. */
export async function GET(req: Request) {
  return withLab(req, { team: true }, async () => Response.json(await engine("/api/benchmark")));
}
