import { openApi } from "@/lib/server/openapi";

export const runtime = "nodejs";
export const dynamic = "force-static";

/** GET /api/docs: OpenAPI 3.1, generated from the same zod schemas the routes validate with. */
export function GET() {
  return Response.json(openApi());
}
