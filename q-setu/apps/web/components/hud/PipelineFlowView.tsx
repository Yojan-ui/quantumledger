"use client";

/**
 * The pipeline view under the HUD's stage text: 3D (components/scenes/PipelineFlow, lazy through LazyView)
 * on desktop with motion allowed; otherwise a static SVG with the same layout and the same data. Station
 * labels and the legend are plain DOM (always readable). What it shows comes only from the FlowModel.
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Details } from "@/components/atlas/AtlasUI";
import { LazyView } from "@/components/scenes/LazyView";
import { frontier, nowLine, stationDone, type FlowModel } from "@/lib/client/atlas-flowviz";

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
    tied = stationDone(m, "tiebreak"),
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
            {tied &&
              b.patches.map((p, j) => (
                <circle
                  key={p}
                  cx={x + (j ? 6 : -6)}
                  cy={y - 7}
                  r={gated && b.applied ? 2.5 : 1.8}
                  opacity={gated && b.applied ? 1 : 0.45}
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

/** Seconds each recorded stage stays in focus during the replay. */
const REPLAY_S = 3.5;

/**
 * Which stage the 3D view focuses: during a live run the stage the SSE events say is running (or the last
 * reached); otherwise a replay that steps through the stages the recorded results contain, labelled as such.
 */
function useFocus(m: FlowModel, still: boolean, following: boolean) {
  const live = following || m.stations.some((s) => s.status === "running");
  const reached = m.stations.flatMap((s, i) => (s.status === "idle" ? [] : [i]));
  const [k, setK] = useState(0);
  const replay = !live && !still && reached.length > 1;
  useEffect(() => {
    if (!replay) return;
    const id = setInterval(() => setK((x) => x + 1), REPLAY_S * 1000);
    return () => clearInterval(id);
  }, [replay]);
  if (!replay) return { focus: frontier(m), replay: false };
  return { focus: reached[k % reached.length]!, replay: true };
}

export function PipelineFlowView({
  model,
  caption,
  stationRow = true,
  tall = false,
  follow = false,
}: {
  model: FlowModel;
  caption: string;
  /** the stage-name row under the canvas (the HUD has its own numbered stepper) */
  stationRow?: boolean;
  /** a taller stage (the diagnostics HUD) */
  tall?: boolean;
  /** a run (live or recorded) is playing: focus follows its frontier, no idle replay */
  follow?: boolean;
}) {
  const still = useStatic();
  const n = Math.max(1, model.stations.length);
  const { focus, replay } = useFocus(model, still, follow);
  const [hover, setHover] = useState<number | null>(null);
  const fs = model.stations[focus];
  const now =
    replay && fs
      ? `Replay of the recorded run · ${fs.label}: ${model.facts[fs.id] ?? fs.plain}`
      : nowLine(model);
  const hs = hover !== null ? model.stations[hover] : undefined;
  const label = `${caption}. ${now ? `${now} ` : ""}${model.batches.length} batches; ${model.stations.map((s) => `${s.label} ${s.status}`).join(", ")}.`;
  return (
    <figure className={`flex flex-col gap-2 ${tall ? "min-h-0 flex-1" : ""}`}>
      {/* data-hud-stage: tells the site's single WebGL canvas to start at once (as the domain HUD does) */}
      <div
        className={`relative ${tall ? "min-h-panel flex-1" : "h-stage-sm"} w-full overflow-hidden rounded-lg border border-line`}
        data-hud-stage
      >
        {still ? (
          <div role="img" aria-label={label} className="h-full w-full">
            <Flow2D m={model} />
          </div>
        ) : (
          <LazyView className="h-full w-full" label={label}>
            {(on) => <PipelineFlow model={model} active={on} focus={focus} onHover={setHover} />}
          </LazyView>
        )}
        {now && (
          <p
            aria-live="polite"
            className="pointer-events-none absolute left-3 right-3 top-2 truncate font-mono text-micro text-fg-2"
          >
            {now}
          </p>
        )}
        {hs && (
          <p
            role="status"
            className="pointer-events-none absolute right-3 top-8 max-w-sm rounded-sm border border-line bg-base px-3 py-2 text-small text-fg"
          >
            <strong className="font-medium">{hs.label}</strong>
            {": "}
            {model.facts[hs.id] ?? "no recorded result"}
          </p>
        )}
        {model.batches.length > 0 && (
          <ul
            aria-label="Legend"
            className="pointer-events-none absolute bottom-2 left-3 right-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-micro text-fg-3"
          >
            <li>
              <span aria-hidden className="mr-1 inline-block h-2 w-2 bg-danger" />
              system · brighter = higher risk
            </li>
            <li>rows = weekly waves</li>
            <li>
              <span aria-hidden className="mr-1 inline-block h-2 w-2 rotate-45 bg-kem" />
              ML-KEM <span aria-hidden className="mx-1 inline-block h-2 w-2 rotate-45 bg-sig" />
              ML-DSA · dim planned, bright gate passed
            </li>
            <li>
              <span aria-hidden className="mr-1 inline-block h-2 w-2 bg-ok" />
              ledger sealed
            </li>
          </ul>
        )}
      </div>
      {stationRow && (
        <ol
          className="hidden gap-1 font-mono text-micro uppercase md:grid"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
          aria-label="Stations"
        >
          {model.stations.map((s) => (
            <li
              key={s.id}
              className={`truncate text-center ${s.status === "done" ? "text-ok" : s.status === "running" ? "text-warn" : s.status === "failed" ? "text-danger" : "text-fg-3"}`}
              title={model.facts[s.id] ? `${s.label}: ${model.facts[s.id]}` : s.label}
            >
              {s.label}
            </li>
          ))}
        </ol>
      )}
      <figcaption className="text-small text-fg-2">{caption}</figcaption>
      {!tall && (
        <>
          <Details summary="How to read this view">
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-small text-fg-3">
              <span>
                <span aria-hidden className="mr-1 inline-block h-2 w-2 bg-danger" /> batch, brighter
                = higher risk weight (assumption)
              </span>
              <span>rows = waves (planned week), left to right = tie-break order</span>
              <span>
                <span aria-hidden className="mr-1 inline-block h-2 w-2 bg-kem" /> ML-KEM ·{" "}
                <span aria-hidden className="mr-1 inline-block h-2 w-2 bg-sig" /> ML-DSA, dim once
                Tie-break has chosen them, bright where the lab gates passed
              </span>
              <span>
                <span aria-hidden className="mr-1 inline-block h-2 w-2 bg-ok" /> ledger sealed and
                verified
              </span>
            </div>
          </Details>
        </>
      )}
    </figure>
  );
}
