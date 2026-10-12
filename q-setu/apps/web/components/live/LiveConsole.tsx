"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui";
import { useLiveEvents } from "@/lib/client/live";
import { opColumns } from "@/lib/client/oplines";
import type { OpEvent } from "@/lib/live/types";

/**
 * A demo's live console: the real operations behind what's on screen, streamed from the bus (and
 * from this browser), newest at the bottom. It auto-scrolls unless paused, and pauses itself if you
 * scroll up to read.
 */
export function LiveConsole({
  title = "Live console",
  filter,
  max = 160,
  highlight,
}: {
  title?: string;
  /** Must be stable (module-level), e.g. `(e) => e.source === "ledger"`. */
  filter?: (e: OpEvent) => boolean;
  max?: number;
  /** Lines that belong to what the stage is showing right now (the director's current shot). */
  highlight?: (e: OpEvent) => boolean;
}) {
  const [paused, setPaused] = useState(false);
  const list = useLiveEvents(filter, max, paused);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const el = box.current;
    if (el && stick.current && !paused) el.scrollTop = el.scrollHeight;
  }, [list, paused]);

  return (
    <section
      aria-label={title}
      className="flex h-console flex-col rounded-lg border border-line bg-inset"
    >
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <Label as="h2" tone="strong" className="flex items-center gap-2">
          <span
            className={`block h-dot w-dot rounded-full ${paused ? "bg-fg-3" : "animate-live bg-accent"}`}
            aria-hidden
          />
          {title}
        </Label>
        <button
          type="button"
          onClick={() => {
            stick.current = true;
            setPaused((p) => !p);
          }}
          aria-pressed={paused}
          className="font-mono text-label uppercase text-fg-3 transition-colors duration-150 hover:text-fg"
        >
          {paused ? "Resume" : "Pause"}
        </button>
      </header>
      <div
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          stick.current = atBottom;
          if (!atBottom && !paused) setPaused(true);
        }}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-label"
        role="log"
        aria-live="off"
      >
        {list.length === 0 && <p className="text-fg-3">Waiting for operations…</p>}
        <ol className="space-y-2">
          {list.map((e) => {
            const c = opColumns(e);
            return (
              <li
                key={`${e.source}-${e.seq}`}
                className={`-mx-2 rounded-sm px-2 transition-colors duration-300 ${highlight?.(e) ? "bg-raised text-fg-2" : "text-fg-3"}`}
              >
                <p className="flex gap-3">
                  <span>{c.time}</span>
                  <span className={`w-16 shrink-0 ${c.failed ? "text-danger" : "text-fg-2"}`}>
                    {c.op}
                  </span>
                  <span className="ml-auto shrink-0">{c.ms}</span>
                  <span className={c.failed ? "text-danger" : "text-ok"}>{c.mark}</span>
                </p>
                <p className="truncate pl-16 normal-case">
                  {e.source === "browser" ? "browser · " : ""}
                  {c.alg}
                  {c.bytes ? ` · ${c.bytes}` : ""}
                  {c.detail ? ` · ${c.detail}` : ""}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
