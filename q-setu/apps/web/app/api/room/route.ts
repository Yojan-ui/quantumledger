import { getRoom } from "@/lib/server/runtime";
import { joinUrl } from "@/lib/server/room-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/room: the room's public key, live counts and the URL phones should open. */
export function GET(req: Request) {
  const room = getRoom();
  return Response.json({ key: room.publicKey(), stats: room.stats(), join: joinUrl(req) });
}
