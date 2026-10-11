"use client";

import Link from "next/link";
import { useState } from "react";
import { Label } from "@/components/ui";
import { scanDate, type ScanView } from "@/lib/scan-types";
import { ScoreRing } from "./ScoreRing";

/** The scan result: score ring, verdict, three plain findings, and what to do next. */
export function ScanResult({ r, compact = false }: { r: ScanView; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const share = `/scan/${encodeURIComponent(r.probe.host)}`;
  return (
    <div className="space-y-8" aria-live="polite">
      <div className="flex items-center gap-6 md:gap-8">
        <ScoreRing score={r.score} />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="truncate text-h2 font-medium text-fg">{r.probe.host}</p>
          <p className="text-body text-fg-2">
            <span className={r.probe.hybridPq ? "text-accent" : "text-warn"}>●</span>{" "}
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
      <ol className="space-y-3 border-t border-line pt-6">
        {r.plain.map((p, i) => {
          const good = /stays sealed|already strong/.test(p);
          return (
            <li
              key={p}
              className="flex animate-reveal gap-3 text-body text-fg-2"
              style={{ animationDelay: `${300 + i * 60}ms` }}
            >
              <span className={`font-mono ${good ? "text-accent" : "text-fg"}`} aria-hidden>
                {good ? "✓" : "✗"}
              </span>
              {p}
            </li>
          );
        })}
      </ol>
      {!compact && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-6">
          <Link
            href="/docs/adapters/shield"
            className="text-small text-fg transition-opacity duration-150 hover:opacity-70"
          >
            Fix this with Q-Setu Shield, zero code change →
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
