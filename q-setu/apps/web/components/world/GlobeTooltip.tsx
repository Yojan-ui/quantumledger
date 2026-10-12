"use client";

/** Mono tooltip that follows the cursor over a hovered globe city or system, with live counts. */
import { useEffect, useRef } from "react";
import { useMetrics } from "@/lib/client/live";
import { bytes, ms } from "@/lib/format";
import { setPinned, useWorld } from "./store";

export function GlobeTooltip() {
  const hover = useWorld((w) => w.hover);
  const metrics = useMetrics();
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (el.current)
        el.current.style.transform = `translate(${e.clientX + 16}px, ${e.clientY + 16}px)`;
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  const city = hover?.id.startsWith("city:") ? hover.id.slice(5) : undefined;
  const c = city ? metrics?.byCity[city] : undefined;
  return (
    <div
      ref={el}
      role="tooltip"
      aria-hidden={!hover}
      className={`pointer-events-none fixed left-0 top-0 z-50 rounded-sm border border-line-strong bg-raised px-3 py-2 font-mono text-label uppercase transition-opacity duration-150 ${hover ? "opacity-100" : "opacity-0"}`}
    >
      <p className="text-fg">{hover?.label ?? ""}</p>
      {city && (
        <p className="mt-1 text-fg-3">
          <span className="text-fg-2">{c?.sealed ?? 0}</span> sealed ·{" "}
          <span className="text-fg-2">{c?.rejected ?? 0}</span> rejected ·{" "}
          <span className="text-fg-2">{c ? ms(c.avgMs) : "–"}</span> avg
          <span className="block">last 60 s</span>
        </p>
      )}
    </div>
  );
}

/**
 * A label pinned by a click on the globe: a city (its live counts, updating) or a packet in flight
 * (its bus event: operation, algorithm, bytes, measured latency, route). 1px outline, anchored where
 * the click was; × or Escape closes it, and a click elsewhere replaces it.
 */
export function PinnedLabel() {
  const pin = useWorld((w) => w.pinned);
  const metrics = useMetrics();
  useEffect(() => {
    if (!pin) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setPinned(null);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [pin]);
  if (!pin) return null;
  const rows: [string, string][] =
    pin.kind === "city"
      ? (() => {
          const c = metrics?.byCity[pin.city];
          return [
            ["sealed", String(c?.sealed ?? 0)],
            ["rejected", String(c?.rejected ?? 0)],
            ["avg", c ? ms(c.avgMs) : "–"],
            ["window", "last 60 s"],
          ];
        })()
      : [
          ["event", `#${pin.info.seq}${pin.info.sim ? " (sim)" : ""}`],
          ["op", pin.info.op],
          ["alg", pin.info.alg],
          ["bytes", pin.info.bytes !== undefined ? bytes(pin.info.bytes) : "–"],
          ["latency", ms(pin.info.ms)],
          ["route", pin.info.from && pin.info.to ? `${pin.info.from} → ${pin.info.to}` : "–"],
        ];
  // Kept inside the viewport: flips left/up near the right and bottom edges.
  const left = Math.min(pin.x + 12, window.innerWidth - 300);
  const top = Math.min(pin.y + 12, window.innerHeight - 200);
  return (
    <div
      role="dialog"
      aria-label={pin.kind === "city" ? `${pin.label}: live counts` : "Packet in flight"}
      className="fixed z-50 w-72 border border-line-strong bg-raised font-mono text-label uppercase"
      style={{ left, top }}
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="text-fg">{pin.kind === "city" ? pin.label : "Packet in flight"}</span>
        <button
          type="button"
          onClick={() => setPinned(null)}
          aria-label="Close"
          className="text-fg-3 transition-colors duration-150 hover:text-fg"
        >
          ×
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 px-3 py-2">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-fg-3">{k}</dt>
            <dd className="min-w-0 truncate text-right tabular text-fg-2">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
