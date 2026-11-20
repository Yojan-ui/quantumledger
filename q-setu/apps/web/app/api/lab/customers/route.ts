import { withLab } from "@/lib/lab/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/lab/customers (team only): every customer, with the team's note and readiness. */
export async function GET(req: Request) {
  return withLab(req, { team: true }, async ({ customers }) => Response.json({ customers }));
}
