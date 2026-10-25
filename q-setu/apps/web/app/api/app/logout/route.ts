import { isSecure, sessionCookie } from "@/lib/server/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/app/logout */
export async function POST(req: Request) {
  return Response.json(
    { ok: true },
    { headers: { "set-cookie": sessionCookie("", isSecure(req), true) } },
  );
}
