"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui";
import { useLiveEvents } from "@/lib/client/live";
import { useCopyMode } from "@/lib/client/copy-mode";
import { opColumns } from "@/lib/client/oplines";
import type { OpEvent } from "@/lib/live/types";

/**
 * A demo's live console: the real operations behind what's on screen, streamed from the bus (and
 * from this browser), newest at the bottom. It auto-scrolls unless paused, and pauses itself if you
 * scroll up to read. As a drawer (`drawer`), it is slim and translucent over the stage, collapsed
 * to its newest 3 lines until clicked (open by default in Technical mode). Before this demo's own
 * operations arrive, it shows the latest real operations on the live bus, labelled as such, so it
 * never sits empty.
 */
const ALL = () => true;
export function LiveConsole({
  title = "Live console",
  filter,
  max = 160,
  highlight,
  drawer = false,
}: {
  title?: string;
  /** Must be stable (module-level), e.g. `(e) => e.source === "ledger"`. */
  filter?: (e: OpEvent) => boolean;
  max?: number;
  /** Lines that belong to what the stage is showing right now (the director's current shot). */
  highlight?: (e: OpEvent) => boolean;
  drawer?: boolean;
}) {
  const [paused, setPaused] = useState(false);
  const own = useLiveEvents(filter, max, paused);
  const bus = useLiveEvents(ALL, 8, paused);
  // Nothing from this demo yet: the latest real operations on the bus, labelled.
  const seeded = own.length === 0 && bus.length > 0;
  const list = seeded ? bus : own;
  const mode = useCopyMode();
  const [open, setOpen] = useState<boolean>();
  const expanded = !drawer || (open ?? mode === "technical");
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const el = box.current;
    if (el && stick.current && !paused) el.scrollTop = el.scrollHeight;
  }, [list, paused]);

  return (
    <section
      aria-label={title}
      className={
        drawer
          ? `flex w-console max-w-full flex-col border border-line bg-glass ${expanded ? "h-console max-h-stage" : ""}`
          : "flex h-console flex-col rounded-lg border border-line bg-inset"
      }
    >
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <Label as="h2" tone="strong" className="flex items-center gap-2">
          <span
            className={`block h-dot w-dot rounded-full ${paused ? "bg-fg-3" : "animate-live bg-accent"}`}
            aria-hidden
          />
          {title}
        </Label>
        {drawer && (
          <button
            type="button"
            onClick={() => setOpen(!expanded)}
            aria-expanded={expanded}
            className="ml-auto mr-4 font-mono text-label uppercase text-fg-3 transition-colors duration-150 hover:text-fg"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        )}
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
        className={`min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-label ${expanded ? "" : "cursor-pointer"}`}
        onClick={() => !expanded && setOpen(true)}
        role="log"
        aria-live="off"
      >
        {list.length === 0 && <p className="text-fg-3">Connecting to the live bus…</p>}
        {seeded && (
          <p className="mb-2 text-fg-3">
            Latest on the live bus (this demo&apos;s appear as they run):
          </p>
        )}
        <ol className="space-y-2">
          {(expanded ? list : list.slice(-3)).map((e) => {
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
