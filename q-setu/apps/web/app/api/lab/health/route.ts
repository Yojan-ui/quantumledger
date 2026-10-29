import webPkg from "@/package.json";
import { LIMITS } from "@/lib/lab/inputs";
import { noStore } from "@/lib/lab/http";
import { testDelayMs } from "@/lib/lab/runs";
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
      // non-zero only in a dev/test server started with LAB_TEST_DELAY_MS
      testDelayMs: testDelayMs(),
      at: new Date().toISOString(),
    },
    { headers: noStore },
  );
}
