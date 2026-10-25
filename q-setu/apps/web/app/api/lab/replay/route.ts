import { fail, readText } from "@/lib/server/api";
import { isDenied } from "@/lib/lab/access";
import { incidentFor } from "@/lib/lab/data";
import { engine } from "@/lib/lab/engine";
import { denied, withLab } from "@/lib/lab/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/lab/replay { incidentId } (team only): asks the engine to replay a saved incident. The
 * engine runs it against its own fresh loopback sandbox and refuses any other host; the browser
 * never sends attack traffic anywhere.
 */
export async function POST(req: Request) {
  return withLab(req, { team: true }, async ({ scope }) => {
    let incidentId: unknown;
    try {
      ({ incidentId } = JSON.parse((await readText(req, 1024)) ?? "{}") as {
        incidentId?: unknown;
      });
    } catch {
      incidentId = undefined;
    }
    if (typeof incidentId !== "string") return fail("invalid_input", "Pick an incident.", 400);
    const d = await incidentFor(scope, incidentId);
    if (isDenied(d)) return denied(d);
    return Response.json(
      await engine<{ id: string }>("/api/replay", {
        method: "POST",
        body: JSON.stringify({ incidentId }),
      }),
      { status: 202 },
    );
  });
}
