import { labFail } from "@/lib/lab/http";
import { findRun, isTerminal, subscribe, type LabEvent } from "@/lib/lab/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TERMINAL_EVENTS = new Set(["result", "error", "cancelled"]);

/**
 * GET /api/lab/runs/{id}/events (Server-Sent Events): replays every event after Last-Event-ID (or ?after=),
 * then streams live ones until the run ends. Each event's id is its sequence number.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = (await ctx.params).id;
  const run = findRun(id);
  if (!run) return labFail("not_found", "No such run", 404);
  const after =
    Number(req.headers.get("last-event-id") ?? new URL(req.url).searchParams.get("after") ?? 0) ||
    0;
  const enc = new TextEncoder();
  const frame = (e: LabEvent) =>
    enc.encode(`id: ${e.seq}\nevent: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`);
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      const send = (e: LabEvent) => {
        if (closed || e.seq <= after) return;
        controller.enqueue(frame(e));
        if (TERMINAL_EVENTS.has(e.type)) close();
      };
      controller.enqueue(enc.encode(`retry: 2000\n: run ${id}\n\n`));
      const seen = new Set<number>();
      const unsub = subscribe(id, (e) => {
        seen.add(e.seq);
        send(e);
      });
      for (const e of run.events) if (!seen.has(e.seq)) send(e);
      const beat = setInterval(() => {
        if (!closed) controller.enqueue(enc.encode(": ping\n\n"));
      }, 15_000);
      cleanup = () => {
        unsub();
        clearInterval(beat);
      };
      req.signal.addEventListener("abort", close);
      if (isTerminal(run.status) && run.events.every((e) => e.seq <= after)) close();
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
