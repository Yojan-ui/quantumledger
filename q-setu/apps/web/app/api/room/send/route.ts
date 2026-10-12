import type { EnvelopeJSON } from "@qsetu/core";
import { fail, parseBody } from "@/lib/server/api";
import { RoomError } from "@/lib/live/room";
import { getRoom } from "@/lib/server/runtime";
import { RoomSendBody } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/room/send { id, envelope, sealMs }: opens a phone's sealed message. If it opens, the
 * reply carries a receipt sealed to the phone's own key (the SHA3-256 of what was read). If the
 * packet was modified, the AES-GCM tag check fails and the reply says why (`ok: false`).
 */
export async function POST(req: Request) {
  const b = await parseBody(req, RoomSendBody);
  if (!b.ok) return b.res;
  try {
    const r = getRoom().receive(b.data.id, b.data.envelope as EnvelopeJSON, b.data.sealMs);
    return Response.json(r);
  } catch (e) {
    if (e instanceof RoomError)
      return e.code === "too_fast"
        ? fail("rate_limited", e.message, 429)
        : fail(
            e.code === "unknown_visitor" ? "not_found" : "invalid_input",
            e.message,
            e.code === "unknown_visitor" ? 404 : 400,
          );
    throw e;
  }
}
