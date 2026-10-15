import { z } from "zod";
import { parseBody } from "@/lib/server/api";
import { runPlugin, type PluginEvent } from "@/lib/server/shield-plugin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({ mode: z.enum(["dns", "container", "code"]).default("dns") }).strict();

/**
 * POST /api/shield/plugin { mode }: "Shield plugs in", for real on loopback (lib/server/shield-plugin).
 * Streams one JSON event per line as each step completes, so the scene's beats follow the work.
 */
export async function POST(req: Request) {
  const b = await parseBody(req, Body);
  if (!b.ok) return b.res;
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(c) {
      const emit = (e: PluginEvent) => c.enqueue(enc.encode(`${JSON.stringify(e)}\n`));
      // One run at a time; a second caller gets an error event (the stream has already started).
      if ((await runPlugin(b.data.mode, emit)) === "busy")
        emit({ t: "error", message: "A run is already in progress. Try again in a moment." });
      c.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" },
  });
}
