import { openStreamSlot } from "@/lib/server/limits";
import { getRoom } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/room/stream: Server-Sent Events for the big screen. `data:` frames are RoomEvents
 * (join / sealed / rejected); an `event: stats` frame follows each one and opens the stream.
 */
export function GET(req: Request) {
  // At most a few open streams per client: each holds a socket and a subscription.
  const release = openStreamSlot(req);
  if (!release)
    return Response.json(
      {
        error: {
          code: "rate_limited",
          message: "Too many open live connections from your network.",
        },
      },
      { status: 429 },
    );
  const room = getRoom();
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (s: string) => {
        try {
          controller.enqueue(enc.encode(s));
        } catch {
          cleanup();
        }
      };
      const stats = () => send(`event: stats\ndata: ${JSON.stringify(room.stats())}\n\n`);
      send(": connected\n\n");
      stats();
      const off = room.subscribe((e) => {
        send(`data: ${JSON.stringify(e)}\n\n`);
        stats();
      });
      const ping = setInterval(() => send(": ping\n\n"), 15_000);
      cleanup = () => {
        release();
        clearInterval(ping);
        off();
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* closed */
        }
      });
    },
    cancel: () => cleanup(),
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
