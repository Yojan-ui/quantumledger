"use client";

/**
 * RISK SCORE: a 0–100 radial gauge (the HNDL risk: 100 minus the scanner's readiness score) that
 * sweeps to each new value, and the Mosca block: X and Y sliders against Z, the estimated years
 * until a cryptographically relevant quantum computer, cited from facts.ts.
 */
import { useEffect, useRef, useState } from "react";
import { easeToken } from "@/lib/ease";
import { setMosca, usePipeline } from "@/lib/client/pipeline";
import { mosca, trustUntil } from "@/lib/mosca";
import { HudPanel } from "./HudPanel";

const R = 52;
const ARC = Math.PI * 1.5; // a 270° gauge
const LEN = R * ARC;

function useTween(target: number, ms = 600) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setV(target);
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const x = a + (target - a) * easeToken(k);
      from.current = x;
      setV(x);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  // The thumb follows the pointer at once; the store (and the scene) catch up on the next frame.
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <label className="block">
      <span className="flex items-baseline justify-between font-mono text-micro uppercase text-fg-3">
        <span>
          {label} <span className="normal-case">{hint}</span>
        </span>
        <span className="tabular text-fg">{local} yr</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={local}
        onChange={(e) => {
          const n = Number(e.target.value);
          setLocal(n);
          onChange(n);
        }}
        className="mt-1 w-full accent-fg"
      />
    </label>
  );
}

export function RiskGauge({ className = "" }: { className?: string }) {
  const risk = usePipeline((s) => s.risk);
  const { x, y } = usePipeline((s) => s.mosca);
  const v = useTween(risk ?? 0);
  const tone =
    risk === undefined ? "text-fg-3" : v >= 50 ? "text-danger" : v >= 20 ? "text-warn" : "text-ok";
  const m = mosca(x, y);
  const verdict = m?.verdict;
  return (
    <HudPanel label="Risk score" className={className}>
      <div className="flex items-center gap-3 px-3 py-2">
        <svg
          viewBox="0 0 128 128"
          className="h-24 w-24 shrink-0"
          role="img"
          aria-label={`HNDL risk ${risk ?? "not scored"} of 100`}
        >
          <g transform="rotate(135 64 64)">
            <circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              className="stroke-line"
              strokeWidth="6"
              strokeDasharray={`${LEN} ${2 * Math.PI * R}`}
            />
            <circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              className={`stroke-current ${tone}`}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${(LEN * v) / 100} ${2 * Math.PI * R}`}
            />
          </g>
          <text
            x="64"
            y="66"
            textAnchor="middle"
            className={`fill-current font-mono text-h3 ${tone}`}
          >
            {risk === undefined ? "—" : Math.round(v)}
          </text>
          <text
            x="64"
            y="86"
            textAnchor="middle"
            className="fill-current font-mono text-micro text-fg-3"
          >
            HNDL / 100
          </text>
        </svg>
        <p className="min-w-0 text-small text-fg-3">
          Harvest-now-decrypt-later risk: 100 minus the scanner&apos;s readiness score.
        </p>
      </div>
      <div className="space-y-2 border-t border-line px-3 py-2" aria-live="polite">
        <p className="font-mono text-micro uppercase text-fg-3">Mosca · X + Y vs Z</p>
        <Slider
          label="X"
          hint="secret for"
          value={x}
          min={1}
          max={50}
          onChange={(n) => setMosca({ x: n })}
        />
        <Slider
          label="Y"
          hint="to migrate"
          value={y}
          min={1}
          max={15}
          onChange={(n) => setMosca({ y: n })}
        />
        {m ? (
          <>
            <p
              className={`font-mono text-small tabular ${verdict === "safe" ? "text-ok" : verdict === "window" ? "text-warn" : "text-danger"}`}
              data-mosca={verdict}
            >
              {x} + {y} = {m.sum} {m.exposed ? ">" : "≤"} Z ({m.z.low}–{m.z.high} yr, estimate)
            </p>
            <p className="font-mono text-micro uppercase text-fg-3">
              TRUST_UNTIL <span className="text-fg">{trustUntil(x)}</span>
            </p>
            <p className="text-small text-fg-3">
              Z is an estimate: {m.z.source}, {m.z.asOf.slice(0, 7)}.{" "}
              <a
                href={m.z.url}
                className="underline decoration-line-strong underline-offset-4"
                target="_blank"
                rel="noreferrer"
              >
                Source
              </a>
              {m.z.note > 0 && (
                <a href={`#fact-${m.z.note}`} className="ml-1 font-mono text-micro">
                  [{m.z.note}]
                </a>
              )}
            </p>
          </>
        ) : (
          <p className="text-small text-fg-3">No verified estimate for Z is available.</p>
        )}
      </div>
    </HudPanel>
  );
}
