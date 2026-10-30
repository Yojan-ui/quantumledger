"use client";

/**
 * Shared pieces for the Q-Shield (Atlas) pages: error / empty / loading states with reserved height (no
 * layout shift), status chips that keep Atlas's own labels, and a hairline table. Tokens only.
 */
import type { ReactNode } from "react";
import type { AtlasError } from "@/lib/client/atlas";
import { Label } from "@/components/ui/type";

/** atlas_down gets the exact fix; any other error shows Atlas's message as-is. */
export function AtlasErrorPanel({ error, onRetry }: { error: AtlasError; onRetry?: () => void }) {
  const down = error.code === "atlas_down";
  return (
    <div role="alert" className="rounded-lg border border-danger p-6">
      <Label tone="strong">
        {down ? "Q-Shield backend not running" : `Q-Shield error · ${error.code}`}
      </Label>
      <p className="mt-2 text-body text-fg-2">{error.message}</p>
      {down && (
        <p className="mt-2 text-small text-fg-3">
          Start it with <code className="font-mono text-fg">pnpm dev:atlas</code> (port 8100), then
          retry.
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 h-10 rounded-sm border border-line-strong px-4 font-mono text-micro uppercase text-fg hover:bg-raised"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/** results.json is missing for this workspace: say so, never show zeros. */
export function NotYetRun({ what, hint }: { what: string; hint?: ReactNode }) {
  return (
    <div className="rounded-lg border border-line p-6">
      <Label>{what}</Label>
      <p className="mt-2 text-body text-fg-2">
        Not yet run: this workspace has no results.json yet.
      </p>
      {hint && <p className="mt-2 text-small text-fg-3">{hint}</p>}
    </div>
  );
}

/** A loading block that reserves the final height so nothing jumps when data arrives. */
export function Skeleton({ className = "h-globe" }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className={`animate-skeleton rounded-lg border border-line bg-raised ${className}`}
    />
  );
}

const TONE: Record<string, string> = {
  PASS: "border-ok text-ok",
  ok: "border-ok text-ok",
  applied: "border-ok text-ok",
  approved: "border-ok text-ok",
  hybrid: "border-ok text-ok",
  FAIL: "border-danger text-danger",
  failed: "border-danger text-danger",
  rolled_back: "border-warn text-warn",
  rollback_failed: "border-danger text-danger",
  rejected: "border-danger text-danger",
  classical: "border-danger text-danger",
  "HNDL-exposed": "border-danger text-danger",
  partially_verified: "border-warn text-warn",
  pending: "border-line-strong text-fg-2",
  not_verified_in_lab: "border-line text-fg-3",
  not_requested: "border-line text-fg-3",
  skipped: "border-line text-fg-3",
  queued: "border-line text-fg-3",
};

/** A status chip with Atlas's own wording (underscores become spaces). */
export function Chip({ status, children }: { status: string; children?: ReactNode }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-sm border px-2 py-px font-mono text-micro uppercase ${TONE[status] ?? "border-line text-fg-2"}`}
    >
      {children ?? status.replaceAll("_", " ")}
    </span>
  );
}

/** A hairline table that scrolls sideways on phones instead of overflowing the page. */
export function Table({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: ReactNode[];
  rows: ReactNode[][];
}) {
  return (
    <div className="max-w-full overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-left text-small">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line">
            {head.map((h, i) => (
              <th
                key={i}
                scope="col"
                className="whitespace-nowrap px-3 py-2 font-mono text-micro font-normal uppercase text-fg-3"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-b-0">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top text-fg-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One titled block inside a workspace page. */
export function Part({
  title,
  label,
  children,
  aside,
}: {
  title: string;
  label?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="border-t border-line py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          {label && <Label className="mb-2 block">{label}</Label>}
          <h2 className="text-h3 font-medium text-fg">{title}</h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** "assumption" / "simulation" / "blocked": honesty labels stay visible, never hidden in a tooltip. */
export function Honesty({
  kind,
  children,
}: {
  kind: "assumption" | "simulation" | "blocked" | "recorded";
  children: ReactNode;
}) {
  return (
    <p className="text-small text-fg-3">
      <span className="mr-2 inline-block rounded-sm border border-warn px-1 font-mono text-micro uppercase text-warn">
        {kind}
      </span>
      {children}
    </p>
  );
}
