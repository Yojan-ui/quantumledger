"use client";

/**
 * PIPELINE: 01 DETECT · 02 SCORE · 03 DEFEND · 04 PROVE · 05 RESCAN. The active stage fills in its
 * role colour, finished ones get a ✓, a hairline fills between them. Each stage has its CTA; Autoplay
 * runs the rest, waiting for each real result and holding it on screen for 1.5 s. Below, a
 * collapsible Legacy vs PQ table from this server's measured benchmark for the selected level.
 */
import { useState } from "react";
import { ROLES } from "@/components/ui/Role";
import { useBench } from "@/lib/client/useBench";
import {
  actions,
  autoplay,
  LEVELS,
  nextStage,
  runStage,
  STAGES,
  usePipeline,
} from "@/lib/client/pipeline";
import { bytes, ms } from "@/lib/format";

function LegacyVsPq() {
  const bench = useBench();
  const level = usePipeline((s) => s.level);
  const L = LEVELS[level];
  const session = bench?.sessions.find((s) => s.profile === L.profile);
  const row = (id: string) => bench?.rows.find((r) => r.id === id);
  const kem = row(L.kem.toLowerCase());
  const sig = row(L.sig.toLowerCase());
  const ecdsa = row("ecdsa-p256");
  const x = row("x25519");
  const lines: [string, string, string][] = [
    ["Key exchange", "X25519 / ECDHE", `X25519 + ${L.kem}`],
    ["Signature", "ECDSA P-256", L.sig],
    [
      "Public key",
      x ? bytes(x.sizes.publicKey) : "…",
      kem && x ? bytes(kem.sizes.publicKey + x.sizes.publicKey) : "…",
    ],
    [
      "Signature size",
      ecdsa ? bytes(ecdsa.sizes.output) : "…",
      sig ? bytes(sig.sizes.output) : "…",
    ],
    [
      "Handshake (CPU)",
      session ? ms(session.classicalHandshakeMs) : "…",
      session ? ms(session.handshakeMs) : "…",
    ],
    ["Handshake bytes", "—", session ? bytes(session.handshakeBytes) : "…"],
    ["Quantum-safe", "✗", "✓"],
  ];
  return (
    <div className="overflow-x-auto px-3 pb-3">
      <table className="w-full font-mono text-micro">
        <caption className="sr-only">Legacy compared with post-quantum at {level}</caption>
        <thead>
          <tr className="text-left uppercase text-fg-3">
            <th className="py-1 pr-3 font-normal">{level} · measured on this server</th>
            <th className="py-1 pr-3 font-normal">Legacy</th>
            <th className="py-1 font-normal">PQ</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(([k, a, b]) => (
            <tr key={k} className="border-t border-line">
              <th scope="row" className="py-1 pr-3 text-left font-normal text-fg-3">
                {k}
              </th>
              <td
                className={`py-1 pr-3 tabular ${k === "Quantum-safe" ? "text-danger" : "text-fg-2"}`}
              >
                {a}
              </td>
              <td className={`py-1 tabular ${k === "Quantum-safe" ? "text-ok" : "text-fg"}`}>
                {b}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {bench && (
        <p className="mt-1 text-small text-fg-3">
          Median of {bench.iterations} runs on {bench.runtime}. Legacy handshake: X25519 + ECDSA
          P-256.
        </p>
      )}
    </div>
  );
}

export function PipelineStepper({ className = "" }: { className?: string }) {
  const s = usePipeline((x) => x);
  const [table, setTable] = useState(false);
  const next = nextStage(s);
  const busy = s.status.includes("running");
  return (
    <div className={`border border-line bg-glass ${className}`} role="group" aria-label="Pipeline">
      <ol className="grid grid-cols-5">
        {STAGES.map((st, i) => {
          const status = s.status[i]!;
          const active = s.stage === i;
          const role = ROLES[st.role];
          return (
            <li
              key={st.id}
              className="relative border-r border-line px-2 py-2 last:border-r-0 md:px-3"
              data-stage={st.id}
              data-status={status}
            >
              {/* The progress hairline: fills as the stage completes. */}
              <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-line">
                <span
                  className={`block h-full transition-all ${role.bg}`}
                  style={{
                    width: status === "done" ? "100%" : status === "running" ? "50%" : "0%",
                    transitionDuration: "600ms",
                  }}
                />
              </span>
              <p
                className={`font-mono text-micro uppercase ${active ? role.text : status === "done" ? "text-fg" : "text-fg-3"}`}
              >
                {status === "done" ? "✓" : st.n} <span className="hidden md:inline">{st.name}</span>
                <span className="md:hidden">{st.name.slice(0, 3)}</span>
              </p>
              <button
                type="button"
                onClick={() => runStage(i)}
                disabled={
                  busy || (i > 0 && s.status[i - 1] !== "done") || (status === "done" && i !== 4)
                }
                data-ripple={st.role}
                className={`mt-1 hidden w-full truncate rounded-sm border px-2 py-1 text-left text-small transition-colors duration-150 disabled:opacity-40 md:block ${i === next ? "border-line-strong text-fg hover:bg-raised" : "border-line text-fg-2"}`}
              >
                {status === "running" ? "Running…" : st.cta}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2">
        <button
          type="button"
          aria-pressed={s.autoplay}
          onClick={() => (s.autoplay ? actions.setAutoplay(false) : void autoplay())}
          className={`h-8 rounded-sm border px-3 font-mono text-micro uppercase transition-colors duration-150 ${s.autoplay ? "border-ok text-ok" : "border-line-strong text-fg"}`}
          data-autoplay
        >
          {s.autoplay ? "Autoplay · on" : "Autoplay"}
        </button>
        <button
          type="button"
          onClick={() => (next < 0 ? actions.replay() : runStage(next))}
          disabled={busy}
          className="h-8 rounded-sm border border-line-strong px-3 font-mono text-micro uppercase text-fg disabled:opacity-40 md:hidden"
        >
          {next < 0 ? "Replay" : STAGES[next]!.cta}
        </button>
        <button
          type="button"
          onClick={() => void actions.replay()}
          className="hidden h-8 rounded-sm border border-line px-3 font-mono text-micro uppercase text-fg-2 hover:text-fg md:inline-block"
        >
          Replay · R
        </button>
        <button
          type="button"
          onClick={() => void actions.tamper()}
          disabled={!s.proof || busy}
          data-ripple="danger"
          className="h-8 rounded-sm border border-line px-3 font-mono text-micro uppercase text-danger disabled:opacity-40"
        >
          Try tamper
        </button>
        <button
          type="button"
          aria-expanded={table}
          onClick={() => setTable((t) => !t)}
          className="ml-auto h-8 px-2 font-mono text-micro uppercase text-fg-3 hover:text-fg"
        >
          Legacy vs PQ {table ? "▲" : "▼"}
        </button>
      </div>
      {s.error && (
        <p role="alert" className="border-t border-line px-3 py-2 text-small text-danger">
          {s.error}
        </p>
      )}
      {table && <LegacyVsPq />}
    </div>
  );
}
