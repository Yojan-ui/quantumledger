import { fail, parseBody } from "@/lib/server/api";
import { clientKey, RateLimiter } from "@/lib/live/rate-limit";
import { RoomError } from "@/lib/live/room";
import { getRoom } from "@/lib/server/runtime";
import { RoomJoinBody } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __qsetuJoinLimit?: RateLimiter };
const limiter = (g.__qsetuJoinLimit ??= new RateLimiter(20, 60_000));

/**
 * POST /api/room/join { publicKey }: a phone joins the room with the public half of a key pair it
 * generated in its own browser. Returns a random visitor ID (its bearer token), a generic name and
 * the room's public key. Nothing personal is asked for or stored.
 */
export async function POST(req: Request) {
  const wait = limiter.take(clientKey(req));
  if (wait) return fail("rate_limited", `Too many joins. Try again in ${wait} s.`, 429);
  const b = await parseBody(req, RoomJoinBody);
  if (!b.ok) return b.res;
  try {
    const room = getRoom();
    const { id, visitor } = room.join(b.data.publicKey);
    return Response.json({ id, visitor, key: room.publicKey() });
  } catch (e) {
    if (e instanceof RoomError) return fail("invalid_input", e.message, 400);
    throw e;
  }
}
