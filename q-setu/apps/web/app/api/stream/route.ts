import { SECTOR_IDS, type NetEvent } from "@qsetu/sim";
import { parseQuery } from "@/lib/server/api";
import { live, policyState } from "@/lib/server/runtime";
import { StreamQuery } from "@/lib/server/schemas";
import { getNetwork } from "@/lib/server/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/stream: Server-Sent Events.
 *  - no `sector`: the live bus. Each frame is one OpEvent (a real operation with its measured time);
 *    an `event: metrics` frame every second carries rolling counts and latency percentiles.
 *  - `sector=fintech|healthcare|education|all`: raw simulator hops (NetEvents), for Demo 3.
 */
export function GET(req: Request) {
  const q = parseQuery(req, StreamQuery);
  if (!q.ok) return q.res;
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
      send(": connected\n\n");
      const offs: (() => void)[] = [];
      if (q.data.sector) {
        const nets =
          q.data.sector === "all" ? SECTOR_IDS.map(getNetwork) : [getNetwork(q.data.sector)];
        for (const net of nets)
          offs.push(net.subscribe((e: NetEvent) => send(`data: ${JSON.stringify(e)}\n\n`)));
      } else {
        const { bus } = live();
        for (const e of bus.history()) send(`data: ${JSON.stringify(e)}\n\n`);
        offs.push(bus.subscribe((e) => send(`data: ${JSON.stringify(e)}\n\n`)));
        const tick = setInterval(
          () => send(`event: metrics\ndata: ${JSON.stringify(bus.metrics(policyState()))}\n\n`),
          1000,
        );
        offs.push(() => clearInterval(tick));
      }
      const ping = setInterval(() => send(": ping\n\n"), 15_000);
      cleanup = () => {
        clearInterval(ping);
        offs.splice(0).forEach((o) => o());
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
