"use client";

/**
 * India Quantum Readiness Index: sector aggregates from one public TLS handshake per domain, shown
 * as bars rising out of the globe over India and as a plain list (the accessible, exact version).
 * Aggregates only: no site is named, ranked or singled out. Anyone can scan a specific site with
 * the scan box.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Text } from "@/components/ui";
import { Copy } from "@/components/ui/Copy";
import { notify, world } from "@/components/world/store";
import { METRICS, pct, READINESS, SECTORS, share, type MetricId } from "@/lib/readiness";
import { useJourney } from "@/lib/client/journey";

const scanDate = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "not yet scanned";

/** One mono label per bar, pinned to the bar's tip on screen (the scene writes world.indexScreen). */
function BarLabels({ values }: { values: number[] }) {
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => setNarrow(window.innerWidth < 768), []);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      SECTORS.forEach((_, i) => {
        const el = refs.current[i];
        const p = world.index ? world.indexScreen[i] : null;
        if (!el) return;
        el.style.opacity = p ? "1" : "0";
        // Narrow globes: alternate labels sit one line higher so neighbours don't collide.
        const lift = narrow && i % 2 ? 18 : 0;
        if (p) el.style.transform = `translate(${p.x}px, ${p.y - lift}px) translate(-50%, -100%)`;
      });
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [narrow]);
  return createPortal(
    <div aria-hidden className="pointer-events-none fixed left-0 top-0 z-20">
      {SECTORS.map((s, i) => (
        <span
          key={s.id}
          ref={(el) => void (refs.current[i] = el)}
          className="absolute left-0 top-0 whitespace-nowrap rounded-sm bg-base px-1 text-center font-mono text-label text-fg-2 opacity-0 transition-opacity duration-150"
        >
          {narrow ? s.short.slice(0, 3) : s.short}
          <br />
          <span className="text-fg">{pct(values[i] ?? 0)}</span>
        </span>
      ))}
    </div>,
    document.body,
  );
}

export function ReadinessBars({
  className = "",
  flight = false,
}: {
  className?: string;
  /** On the homepage: this section's stretch of the camera flight (a low angle over India). */
  flight?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useJourney(ref, flight ? 2 : -1, flight ? 3 : -1);
  const [metric, setMetric] = useState<MetricId>("hybridPq");
  const [on, setOn] = useState(false);
  const m = METRICS.find((x) => x.id === metric)!;
  const values = SECTORS.map((s) => {
    const a = READINESS.sectors[s.id];
    return a ? share(a, metric) : 0;
  });

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setOn(!!e?.isIntersecting), { threshold: 0.35 });
    if (ref.current) io.observe(ref.current);
    return () => {
      io.disconnect();
      world.index = null;
    };
  }, []);
  useEffect(() => {
    if (on) {
      world.index = { values, good: m.good, at: performance.now() };
      world.glow = "ok";
    } else world.index = null;
    notify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, metric]);

  const all = READINESS.all;
  return (
    <div ref={ref} className={`grid grid-cols-12 gap-x-6 gap-y-10 ${className}`}>
      <div className="col-span-12 md:col-span-5">
        <p className="text-small text-fg-2">
          Of {all.reachable} public Indian sites we connected to,
        </p>
        <p className="mt-2 font-mono text-h3 text-fg md:text-h2" data-index-headline>
          {pct(share(all, metric))}
        </p>
        <p className="mt-2 text-body text-fg">
          <span data-copy="technical">{m.label}.</span>
          <span data-copy="simple">{m.simple}.</span>
        </p>
        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Measure">
          {METRICS.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={metric === x.id}
              onClick={() => setMetric(x.id)}
              className={`h-8 rounded-sm border px-3 font-mono text-label uppercase transition-colors duration-150 ${metric === x.id ? "border-fg text-fg" : "border-line text-fg-3 hover:text-fg"}`}
            >
              <Copy
                simple={
                  x.id === "hybridPq"
                    ? "Quantum-safe lock"
                    : x.id === "tls13"
                      ? "Newest standard"
                      : "Old ID keys"
                }
                technical={
                  x.id === "hybridPq"
                    ? "Hybrid PQ"
                    : x.id === "tls13"
                      ? "TLS 1.3"
                      : "RSA-2048 certs"
                }
              />
            </button>
          ))}
        </div>
        <ul className="mt-8 border-b border-line" aria-label="Readiness by sector">
          {SECTORS.map((s, i) => {
            const a = READINESS.sectors[s.id];
            const v = values[i]!;
            const ready = m.good ? v : 1 - v;
            return (
              <li key={s.id} className="border-t border-line py-3" data-sector={s.id}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-small text-fg">
                    <span data-copy="technical">{s.label}</span>
                    <span data-copy="simple">{s.simple}</span>
                  </span>
                  <span className="font-mono text-small text-fg">{pct(v)}</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-inset" aria-hidden>
                  <div
                    className="h-full origin-left rounded-full transition duration-700"
                    style={{
                      transform: `scaleX(${Math.max(0.01, v)})`,
                      background: `color-mix(in srgb, var(--warn) ${Math.round((1 - ready) * 100)}%, var(--ok))`,
                    }}
                  />
                </div>
                <p className="mt-1 font-mono text-label text-fg-3">
                  {a
                    ? `${a[metric]} of ${a.reachable} reachable · ${a.targets} scanned`
                    : "no data"}
                </p>
              </li>
            );
          })}
        </ul>
        <Text size="small" className="mt-4">
          Scanned {scanDate(READINESS.finishedAt)}. Sector totals only: we don&apos;t rank or name
          sites.{" "}
          <Link
            href="/index#method"
            className="text-fg underline decoration-line-strong underline-offset-4"
          >
            Methodology and disclaimer
          </Link>
          {" · "}
          <Link
            href="/#scan"
            className="text-fg underline decoration-line-strong underline-offset-4"
          >
            Scan a site yourself
          </Link>
        </Text>
      </div>
      {on && <BarLabels values={values} />}
      {/* On phones the globe comes first, so the bars are seen before the list. */}
      <div className="relative order-first col-span-12 md:order-none md:col-span-7">
        <div
          data-world-focus
          data-world-drag
          className="h-globe md:sticky md:top-14 md:h-story"
          aria-hidden
        />
      </div>
    </div>
  );
}
