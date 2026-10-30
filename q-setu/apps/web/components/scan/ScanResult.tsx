"use client";

import Link from "next/link";
import { useState } from "react";
import { Details } from "@/components/atlas/AtlasUI";
import { Label, RoleDot } from "@/components/ui";
import { quantumBreaks, recommendedFixes, SCORE_WEIGHTS } from "@/lib/scan-explain";
import { scanDate, type ScanView } from "@/lib/scan-types";
import { ScoreRing } from "./ScoreRing";
import { SendToPipeline } from "./SendToPipeline";

function Card({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <li className="flex h-full min-w-0 flex-col gap-1 rounded-lg border border-line p-4">
      <span className="font-mono text-micro uppercase text-fg-3">{label}</span>
      <span className="break-all text-body font-medium text-fg">{value || "–"}</span>
      {note && <span className="break-all text-small text-fg-2">{note}</span>}
    </li>
  );
}

/** The scanner's own arithmetic for this result, kind by kind (packages/core scoreFindings). */
function ScoreFormula({ r }: { r: ScanView }) {
  const kinds = new Map<string, { severity: string; n: number }>();
  for (const f of r.findings) {
    const k = `${f.ruleId}:${f.severity}`;
    const c = kinds.get(k);
    if (c) c.n++;
    else kinds.set(k, { severity: f.severity, n: 1 });
  }
  const rows = [...kinds].filter(([, v]) => v.severity !== "info");
  return (
    <Details summary="How the score is computed">
      <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-small text-fg-2">
        {`score = max(0, 100 − Σ_kinds ( w(severity) + 2 · min(n − 1, 5) ))
w: critical ${SCORE_WEIGHTS.critical} · high ${SCORE_WEIGHTS.high} · medium ${SCORE_WEIGHTS.medium} · low ${SCORE_WEIGHTS.low} · info ${SCORE_WEIGHTS.info}
grade: Quantum-ready if score ≥ 80 and no high/critical quantum-vulnerable finding;
       At risk if score ≥ 50; otherwise Critical`}
      </pre>
      {rows.length > 0 && (
        <ul className="space-y-1 font-mono text-small text-fg-2">
          {rows.map(([k, v]) => (
            <li key={k} className="break-words">
              {k.split(":")[0]} ({v.severity}, ×{v.n}): −
              {SCORE_WEIGHTS[v.severity as keyof typeof SCORE_WEIGHTS] + Math.min(v.n - 1, 5) * 2}
            </li>
          ))}
          <li className="text-fg">= {r.score}</li>
        </ul>
      )}
      <p>
        Inputs: the negotiated TLS version, key-exchange group, cipher and certificate key from one
        handshake. The score is a readiness heuristic, not a security audit.
      </p>
    </Details>
  );
}

/** The scan result: score ring, verdict, the handshake as cards, what breaks, the fixes, and next steps. */
export function ScanResult({ r, compact = false }: { r: ScanView; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const share = `/scan/${encodeURIComponent(r.probe.host)}`;
  return (
    <div className="space-y-8" aria-live="polite">
      <div className="flex items-center gap-6 md:gap-8">
        <ScoreRing score={r.score} />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="truncate text-h2 font-medium text-fg">{r.probe.host}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-body text-fg-2">
            <RoleDot role={r.probe.hybridPq ? "kem" : "warn"} />
            {r.probe.hybridPq ? "Hybrid post-quantum key exchange" : "Harvestable today"} ·
            readiness {r.grade.toLowerCase()}
          </p>
          <Label as="p">
            {r.probe.protocol} · {r.probe.group} · {r.probe.certKey} ·{" "}
            {r.geo.source === "lookup" ? `server in ${r.geo.label}` : "server location unknown"}
          </Label>
          {r.cached && (
            <Label as="p" tone="strong">
              Cached scan from {scanDate(r.scannedAt)} · offline
            </Label>
          )}
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Handshake">
        <Card label="TLS version" value={r.probe.protocol ?? ""} note={r.probe.cipher} />
        <Card
          label="Key exchange"
          value={r.probe.group}
          note={r.probe.hybridPq ? "hybrid post-quantum" : "classical"}
        />
        <Card label="Certificate" value={r.probe.certKey} note={r.probe.certSigAlg} />
        <Card
          label="Expires"
          value={
            Number.isNaN(Date.parse(r.probe.validTo)) ? r.probe.validTo : scanDate(r.probe.validTo)
          }
          note={r.probe.issuer || undefined}
        />
      </ul>
      <div className="grid grid-cols-1 gap-6 border-t border-line pt-6">
        <section className="space-y-3">
          <h3 className="text-body font-medium text-fg">What a quantum computer breaks here</h3>
          <ul className="space-y-2">
            {quantumBreaks(r.probe).map((b) => (
              <li key={b.part} className="flex gap-3 text-body text-fg-2">
                <span className={`font-mono ${b.safe ? "text-ok" : "text-warn"}`} aria-hidden>
                  {b.safe ? "✓" : "✗"}
                </span>
                <span>
                  <strong className="font-medium text-fg">{b.part}:</strong> {b.text}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-3">
          <h3 className="text-body font-medium text-fg">Recommended fixes</h3>
          <ol className="list-decimal space-y-2 pl-5 text-body text-fg-2">
            {recommendedFixes(r.probe).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ol>
        </section>
      </div>
      <ScoreFormula r={r} />
      {!compact && <SendToPipeline host={r.probe.host} />}
      {!compact && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-6">
          <Link
            href="/docs/adapters/shield"
            className="text-small text-fg transition-opacity duration-150 hover:opacity-70"
          >
            Fix this with QuantumLedger Shield, zero code change →
          </Link>
          <button
            type="button"
            onClick={() =>
              void navigator.clipboard?.writeText(location.origin + share).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
            }
            className="text-small text-fg-2 transition-colors duration-150 hover:text-fg"
          >
            {copied ? "Link copied ✓" : "Share result"}
          </button>
          <Link
            href={share}
            className="text-small text-fg-3 transition-colors duration-150 hover:text-fg"
          >
            Open result page
          </Link>
        </div>
      )}
    </div>
  );
}

/** Placeholder with the result's exact layout, so nothing jumps when it arrives. */
export function ScanSkeleton() {
  return (
    <div className="space-y-8" aria-hidden>
      <div className="flex items-center gap-8">
        <div className="h-32 w-32 shrink-0 animate-skeleton rounded-full border border-line-strong" />
        <div className="flex-1 space-y-3">
          <div className="h-8 w-2/3 animate-skeleton rounded-sm bg-raised" />
          <div className="h-5 w-1/2 animate-skeleton rounded-sm bg-raised" />
          <div className="h-4 w-3/4 animate-skeleton rounded-sm bg-raised" />
        </div>
      </div>
      <div className="space-y-3 border-t border-line pt-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-5 w-full animate-skeleton rounded-sm bg-raised" />
        ))}
      </div>
    </div>
  );
}
