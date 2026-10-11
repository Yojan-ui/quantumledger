"use client";

import { CountUp } from "@/components/ui/CountUp";

/** A 0–100 readiness ring that fills once (700 ms, motion easing), with the number counting up inside. */
export function ScoreRing({ score, size = 128 }: { score: number; size?: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line-strong)" strokeWidth="2" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--text)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={c}
          className="animate-ring"
          style={{ strokeDashoffset: c * (1 - score / 100), ["--ring-from" as string]: String(c) }}
        />
      </svg>
      <p className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-h2 font-medium text-fg">
          <CountUp to={score} format={(n) => String(Math.round(n))} ms={700} />
        </span>
        <span className="font-mono text-label uppercase text-fg-3">/ 100</span>
      </p>
    </div>
  );
}
