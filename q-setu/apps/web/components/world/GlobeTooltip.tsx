"use client";

/** Mono tooltip that follows the cursor over a hovered globe city or system, with live counts. */
import { useEffect, useRef } from "react";
import { useMetrics } from "@/lib/client/live";
import { ms } from "@/lib/format";
import { useWorld } from "./store";

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
