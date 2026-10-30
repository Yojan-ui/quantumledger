"use client";

/**
 * The pipeline view under the HUD's stage text: 3D (components/scenes/PipelineFlow, lazy through LazyView)
 * on desktop with motion allowed; otherwise a static SVG with the same layout and the same data. Station
 * labels and the legend are plain DOM (always readable). What it shows comes only from the FlowModel.
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { LazyView } from "@/components/scenes/LazyView";
import { frontier, stationDone, type FlowModel } from "@/lib/client/atlas-flowviz";

const PipelineFlow = dynamic(() => import("@/components/scenes/PipelineFlow"), { ssr: false });

function useStatic() {
  const [s, setS] = useState(true); // SSR and first paint: the static view (no layout shift when 3D mounts)
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce), (max-width: 767px)");
    const on = () => setS(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return s;
}

const FILL: Record<string, string> = {
  done: "fill-ok",
  failed: "fill-danger",
  running: "fill-warn",
  idle: "fill-line-strong",
};

function Flow2D({ m }: { m: FlowModel }) {
  const n = Math.max(1, m.stations.length);
  const W = 900,
    H = 300,
    xOf = (i: number) => 40 + (i * (W - 80)) / Math.max(1, n - 1);
  const f = Math.max(0, frontier(m)),
    planned = stationDone(m, "schedule"),
    gated = stationDone(m, "gates"),
    sealed = stationDone(m, "seal");
  const rows = Math.max(1, m.waves),
    rowH = Math.min(18, 200 / rows);
  const seal = m.stations.findIndex((s) => s.id === "seal");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" aria-hidden>
      {m.stations.map((s, i) => (
        <rect
          key={s.id}
          x={xOf(i) - 30}
          y={H - 26}
          width={60}
          height={4}
          className={FILL[s.status]}
        />
      ))}
      {m.batches.slice(0, 160).map((b, i) => {
        const x =
          planned && b.wave >= 0 ? xOf(f) + (b.slot - 1) * 12 : xOf(f) + ((i % 4) - 1.5) * 12;
        const y = planned && b.wave >= 0 ? 24 + b.wave * rowH : 24 + Math.floor(i / 4) * 12;
        return (
          <g key={b.id}>
            <rect
              x={x - 4}
              y={y - 4}
              width={8}
              height={8}
              className="fill-danger"
              opacity={0.2 + 0.8 * b.risk}
            />
            {gated &&
              b.applied &&
              b.patches.map((p, j) => (
                <circle
                  key={p}
                  cx={x + (j ? 6 : -6)}
                  cy={y - 7}
                  r={2.5}
                  className={p === "kem" ? "fill-kem" : "fill-sig"}
                />
              ))}
          </g>
        );
      })}
      {Array.from({ length: Math.min(16, m.ledger.entries) }, (_, i) => (
        <rect
          key={i}
          x={xOf(seal >= 0 ? seal : n - 1) + 36}
          y={H - 40 - i * 9}
          width={14}
          height={6}
          className={sealed ? (m.ledger.verified ? "fill-ok" : "fill-sig") : "fill-line"}
        />
      ))}
    </svg>
  );
}

export function PipelineFlowView({ model, caption }: { model: FlowModel; caption: string }) {
  const still = useStatic();
  const n = Math.max(1, model.stations.length);
  const label = `${caption}. ${model.batches.length} batches; ${model.stations.map((s) => `${s.label} ${s.status}`).join(", ")}.`;
  return (
    <figure className="flex flex-col gap-2">
      {/* data-hud-stage: tells the site's single WebGL canvas to start at once (as the domain HUD does) */}
      <div
        className="relative h-stage-sm w-full overflow-hidden rounded-lg border border-line"
        data-hud-stage
      >
        {still ? (
          <div role="img" aria-label={label} className="h-full w-full">
            <Flow2D m={model} />
          </div>
        ) : (
          <LazyView className="h-full w-full" label={label}>
            {(on) => <PipelineFlow model={model} active={on} />}
          </LazyView>
        )}
      </div>
      <ol
        className="grid gap-1 font-mono text-micro uppercase"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        aria-label="Stations"
      >
        {model.stations.map((s) => (
          <li
            key={s.id}
            className={`truncate text-center ${s.status === "done" ? "text-ok" : s.status === "running" ? "text-warn" : s.status === "failed" ? "text-danger" : "text-fg-3"}`}
            title={s.label}
          >
            {s.label}
          </li>
        ))}
      </ol>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-micro text-fg-3">
        <span>{caption}</span>
        <span>
          <span aria-hidden className="mr-1 inline-block h-2 w-2 bg-danger" /> batch, brighter =
          higher risk weight (assumption)
        </span>
        <span>rows = waves (planned week), left to right = tie-break order</span>
        <span>
          <span aria-hidden className="mr-1 inline-block h-2 w-2 bg-kem" /> ML-KEM ·{" "}
          <span aria-hidden className="mr-1 inline-block h-2 w-2 bg-sig" /> ML-DSA, shown once the
          lab gates pass
        </span>
        <span>
          <span aria-hidden className="mr-1 inline-block h-2 w-2 bg-ok" /> ledger sealed and
          verified
        </span>
      </figcaption>
    </figure>
  );
}
