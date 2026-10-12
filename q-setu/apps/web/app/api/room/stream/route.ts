import { getRoom } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/room/stream: Server-Sent Events for the big screen. `data:` frames are RoomEvents
 * (join / sealed / rejected); an `event: stats` frame follows each one and opens the stream.
 */
export function GET(req: Request) {
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
