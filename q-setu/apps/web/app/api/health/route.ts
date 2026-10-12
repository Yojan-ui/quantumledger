export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/health: a cheap liveness check, used to keep the API warm and to detect a cold start. */
export function GET() {
  return Response.json({ ok: true, at: Date.now() }, { headers: { "cache-control": "no-store" } });
}
