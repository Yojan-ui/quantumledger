import { fail } from "@/lib/server/api";
import { runLive } from "@/lib/server/shield-live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/shield/live: runs the attack suite against the legacy bank, bare and behind Shield Edge. */
export async function POST() {
  const r = await runLive();
  if (r === "busy")
    return fail("conflict", "A run is already in progress. Try again in a minute.", 409);
  return Response.json(r, { headers: { "cache-control": "no-store" } });
}
