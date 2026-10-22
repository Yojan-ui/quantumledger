import { modelDetail } from "@/lib/lab/data";
import { withLab } from "@/lib/lab/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/lab/model: the threat model's accuracy, features and signed updates (no customer data). */
export async function GET(req: Request) {
  return withLab(req, {}, async () => Response.json(await modelDetail()));
}
