import { noStore } from "@/lib/lab/http";
import { createWorkspace } from "@/lib/lab/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/lab/workspaces: a new workspace (its id goes in the UI's URL). */
export function POST() {
  return Response.json(createWorkspace(), { status: 201, headers: noStore });
}
