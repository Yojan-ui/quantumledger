"use client";

/**
 * DIAGNOSTICS: key-value readouts for the run. Each row eases its value and colour when the pipeline
 * changes it (600 ms), numbers roll. Real values are plain; simulated ones end in "(sim)".
 */
import { useEffect, useRef, useState } from "react";
import { Odometer } from "@/components/ui/Odometer";
import { onMetrics } from "@/lib/client/live";
import { ms } from "@/lib/format";
import { LEVELS, shorExposure, usePipeline, type PipelineState } from "@/lib/client/pipeline";
import { HudPanel } from "./HudPanel";

type Tone = "danger" | "warn" | "ok" | "kem" | "sig" | "muted";
const TONE: Record<Tone, string> = {
  danger: "text-danger",
  warn: "text-warn",
  ok: "text-ok",
  kem: "text-kem",
  sig: "text-sig",
  muted: "text-fg-3",
};

const hex = (h?: string, n = 16) => (h ? `${h.slice(0, n)}…` : "—");

function rows(
  s: PipelineState,
): { k: string; v: string; tone: Tone; num?: boolean; title?: string }[] {
  const scan = s.scan?.probe;
  const patched = s.status[2] === "done" && s.patch;
  const L = LEVELS[s.patch?.level ?? s.level];
  const exp = shorExposure(s);
  return [
    {
      k: "TARGET",
      v: s.domain || "—",
      tone: s.domain ? "muted" : "muted",
      title: s.cached ? "cached real scan" : undefined,
    },
    {
      k: "TLS_VERSION",
      v: patched ? "TLSv1.3 (sim)" : (scan?.protocol ?? "—"),
      tone: patched ? "ok" : scan?.protocol === "TLSv1.3" ? "muted" : scan ? "warn" : "muted",
    },
    {
      k: "KEX_GROUP",
      v: patched ? `${L.group} (sim)` : (scan?.group ?? "—"),
      tone: patched ? "kem" : scan ? (scan.hybridPq ? "ok" : "danger") : "muted",
    },
    {
      k: "CERT_KEY",
      v: patched ? `${L.sig} (sim)` : (scan?.certKey ?? "—"),
      tone: patched ? "sig" : scan ? "danger" : "muted",
    },
    {
      k: "SHOR_EXPOSURE",
      v: s.scan ? `${exp.pct}%${exp.sim ? " (sim)" : ""}` : "—",
      tone: !s.scan ? "muted" : exp.pct === 0 ? "ok" : exp.pct >= 100 ? "danger" : "warn",
      num: true,
    },
    {
      k: "HNDL_RISK",
      v: s.risk === undefined ? "—" : `${s.risk}/100`,
      tone: s.risk === undefined ? "muted" : s.risk >= 50 ? "danger" : s.risk >= 20 ? "warn" : "ok",
      num: true,
    },
    { k: "MERKLE_ROOT", v: hex(s.proof?.root), tone: s.proof ? "sig" : "muted" },
    {
      k: "BLOCK_HASH",
      v: s.proof ? `#${s.proof.anchorId} ${hex(s.proof.blockHash, 12)}` : "—",
      tone: s.proof ? "sig" : "muted",
    },
    {
      k: "SIGNATURE",
      v: s.proof ? `${s.proof.alg} ${hex(s.proof.signature, 12)}` : "—",
      tone: s.proof ? (s.sweep?.ok ? "ok" : "sig") : "muted",
    },
  ];
}

/** Rolls the leading number; the rest ("% (sim)", "/100") follows as plain text. */
function RollingValue({ v }: { v: string }) {
  const m = /^(\d+)(.*)$/.exec(v);
  if (!m) return <>{v}</>;
  return (
    <>
      <Odometer value={m[1]!} />
      {m[2]}
    </>
  );
}

/** The crypto operations whose live latency the panel plots. */
const SPARK_OPS = [
  { op: "SIGN", label: "ML-DSA sign", tone: "text-sig" },
  { op: "VERIFY", label: "ML-DSA verify", tone: "text-ok" },
  { op: "SEAL", label: "ML-KEM seal", tone: "text-kem" },
] as const;
const SAMPLES = 60;

/**
 * Live latency, one sparkline per operation: the server's rolling p50 for each, sampled once a
 * second (the metrics frame), last 60 s. Real measurements of the running mesh.
 */
function Sparklines() {
  const hist = useRef<Record<string, number[]>>({});
  const [, setTick] = useState(0);
  useEffect(
    () =>
      onMetrics((m) => {
        for (const { op } of SPARK_OPS) {
          const v = m.byOp[op]?.p50;
          if (v === undefined) continue;
          const h = (hist.current[op] ??= []);
          h.push(v);
          if (h.length > SAMPLES) h.shift();
        }
        setTick((t) => t + 1);
      }),
    [],
  );
  return (
    <div className="border-t border-line px-3 py-3">
      <p className="mb-2 font-mono text-micro uppercase text-fg-3">Live latency · p50 · 60 s</p>
      <ul className="space-y-2">
        {SPARK_OPS.map(({ op, label, tone }) => {
          const h = hist.current[op] ?? [];
          const max = Math.max(1e-6, ...h);
          const pts = h
            .map((v, i) => `${(i / (SAMPLES - 1)) * 100},${20 - (v / max) * 18}`)
            .join(" ");
          return (
            <li key={op} className="grid grid-cols-entry items-center gap-x-2 font-mono text-micro">
              <span className="truncate uppercase text-fg-3">{label}</span>
              <span className="flex items-center gap-2">
                <svg
                  viewBox="0 0 100 20"
                  preserveAspectRatio="none"
                  className={`h-5 min-w-0 flex-1 ${tone}`}
                  aria-hidden
                >
                  {h.length > 1 && (
                    <polyline
                      points={pts}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </svg>
                <span className="w-16 shrink-0 text-right tabular text-fg">
                  {h.length ? ms(h[h.length - 1]!) : "–"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The algorithm suite for each level; the one the live policy runs is lit. */
function SuiteCard({ level }: { level: PipelineState["level"] }) {
  return (
    <div className="border-t border-line px-3 py-3">
      <p className="mb-2 font-mono text-micro uppercase text-fg-3">Algorithm suite</p>
      <ul className="space-y-1 font-mono text-micro">
        {(Object.keys(LEVELS) as PipelineState["level"][]).map((l) => (
          <li
            key={l}
            title={`${l} ${LEVELS[l].label}: ${LEVELS[l].kem} + ${LEVELS[l].sig} (${LEVELS[l].group})`}
            className={`flex items-baseline justify-between gap-x-2 rounded-sm px-1 py-1 ${l === level ? "bg-raised text-fg" : "text-fg-3"}`}
          >
            <span className="uppercase">{l}</span>
            <span className="text-right">
              {LEVELS[l].kem} · {LEVELS[l].sig}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Diagnostics({ className = "" }: { className?: string }) {
  const s = usePipeline((x) => x);
  return (
    <HudPanel label="Diagnostics" className={className}>
      <div className="flex h-full flex-col">
        <dl className="grid grid-cols-1 font-mono text-micro uppercase">
          {rows(s).map((r) => (
            <div
              key={r.k}
              className="flex items-baseline justify-between gap-3 border-b border-line px-3 py-2 last:border-b-0"
              title={r.title}
            >
              <dt className="shrink-0 text-fg-3">{r.k}</dt>
              <dd
                className={`min-w-0 truncate text-right normal-case tabular transition-colors ${TONE[r.tone]}`}
                style={{ transitionDuration: "600ms" }}
                data-diag={r.k}
              >
                {r.num ? <RollingValue v={r.v} /> : r.v}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-auto">
          <Sparklines />
          <SuiteCard level={s.level} />
        </div>
      </div>
    </HudPanel>
  );
}
