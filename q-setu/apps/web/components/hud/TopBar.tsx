"use client";

/**
 * The HUD's status bar: the brand lockup, a coordinate readout from real state (the handshake
 * session and the live mesh), the security level (it hot-swaps the server's policy for real), a
 * clock, the threat pill, sound, and the exports (REPORT.PDF, the real CBOM.JSON).
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Mark } from "@/components/ui/Logo";
import { useMetrics } from "@/lib/client/live";
import {
  actions,
  getPipeline,
  LEVELS,
  threat,
  usePipeline,
  type Level,
} from "@/lib/client/pipeline";
import { download, reportPdf } from "@/lib/client/report-pdf";
import { setSfx, useSfx } from "@/lib/client/sfx";
import { WORDMARK } from "@/lib/brand/mark";

const PILL = {
  critical: { text: "THREAT CRITICAL", cls: "border-danger text-danger" },
  mitigating: { text: "MITIGATING", cls: "border-warn text-warn" },
  secured: { text: "SECURED", cls: "border-ok text-ok" },
} as const;

function Clock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const tick = () => setT(new Date().toTimeString().slice(0, 8));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <time
      className="font-mono text-micro tabular text-fg-2"
      aria-label="Local time"
      suppressHydrationWarning
    >
      {t}
    </time>
  );
}

export function TopBar({ compact = false }: { compact?: boolean }) {
  const s = usePipeline((x) => x);
  const metrics = useMetrics();
  const sfx = useSfx();
  const pill = PILL[threat(s)];
  // Keep the toggle honest if the policy changes elsewhere (presenter, another tab).
  useEffect(() => {
    if (metrics?.policy && !s.status.includes("running")) actions.syncLevel(metrics.policy.profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics?.policy?.profile]);
  const btn =
    "h-7 rounded-sm border border-line px-2 font-mono text-micro uppercase transition-colors duration-150";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border border-line bg-glass px-3 py-2">
      <Link href="/" className="flex items-center gap-2 text-fg" aria-label="QuantumLedger home">
        <Mark className="h-4 w-4" />
        <span className="font-mono text-micro tracking-widest">{WORDMARK}</span>
        {!compact && (
          <span className="hidden font-mono text-micro uppercase text-fg-3 lg:inline">
            · PQC DIAGNOSTICS · TLS QUANTUM-READINESS
          </span>
        )}
      </Link>
      <span
        className="hidden font-mono text-micro uppercase tabular text-fg-3 xl:inline"
        data-coords
      >
        SID {s.patch ? s.patch.sessionId.slice(0, 8) : "--------"} · NODES{" "}
        {metrics?.policy.links ?? "–"} · G{metrics?.policy.generation ?? "–"}
      </span>
      <div
        role="radiogroup"
        aria-label="Security level"
        className="flex items-center border border-line"
      >
        {(Object.keys(LEVELS) as Level[]).map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={s.level === l}
            disabled={s.status.includes("running")}
            onClick={() => void actions.setLevel(l)}
            title={`${LEVELS[l].kem} · ${LEVELS[l].sig}`}
            className={`h-7 px-2 font-mono text-micro uppercase transition-colors duration-150 disabled:opacity-40 ${s.level === l ? "bg-raised text-fg" : "text-fg-3 hover:text-fg"}`}
          >
            {l} <span className="hidden md:inline">{LEVELS[l].label}</span>
          </button>
        ))}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Clock />
        <span
          role="status"
          aria-live="polite"
          className={`rounded-sm border px-2 py-1 font-mono text-micro uppercase transition-colors ${pill.cls}`}
          style={{ transitionDuration: "600ms" }}
          data-threat={threat(s)}
        >
          {pill.text}
        </span>
        <button
          type="button"
          aria-pressed={sfx}
          onClick={() => setSfx(!sfx)}
          className={`${btn} ${sfx ? "text-fg" : "text-fg-3"}`}
        >
          SFX {sfx ? "ON" : "OFF"}
        </button>
        {!compact && (
          <>
            <button
              type="button"
              disabled={!s.scan}
              onClick={() =>
                download(reportPdf(getPipeline()), `quantumledger-${s.domain || "report"}.pdf`)
              }
              className={`${btn} text-fg-2 hover:text-fg disabled:opacity-40`}
            >
              REPORT.PDF
            </button>
            <button
              type="button"
              disabled={!s.scan}
              onClick={() =>
                download(
                  new Blob([JSON.stringify(getPipeline().scan?.cbom, null, 2)], {
                    type: "application/json",
                  }),
                  `cbom-${s.domain || "scan"}.json`,
                )
              }
              className={`${btn} text-fg-2 hover:text-fg disabled:opacity-40`}
            >
              CBOM.JSON
            </button>
          </>
        )}
      </div>
    </div>
  );
}
