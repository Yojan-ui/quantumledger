"use client";

/**
 * DIAGNOSTICS: key-value readouts for the run. Each row eases its value and colour when the pipeline
 * changes it (600 ms), numbers roll. Real values are plain; simulated ones end in "(sim)".
 */
import { Odometer } from "@/components/ui/Odometer";
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

export function Diagnostics({ className = "" }: { className?: string }) {
  const s = usePipeline((x) => x);
  return (
    <HudPanel label="Diagnostics" className={className}>
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
    </HudPanel>
  );
}
