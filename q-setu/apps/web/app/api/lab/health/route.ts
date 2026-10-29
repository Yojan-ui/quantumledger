import webPkg from "@/package.json";
import { LIMITS } from "@/lib/lab/inputs";
import { noStore } from "@/lib/lab/http";
import { isOffline } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/lab/health: version, offline flag and input limits for the lab UI. */
export function GET() {
  return Response.json(
    {
      ok: true,
      version: webPkg.version,
      offline: isOffline(),
      limits: LIMITS,
      at: new Date().toISOString(),
    },
    { headers: noStore },
  );
}
