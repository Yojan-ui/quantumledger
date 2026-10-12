"use client";

/**
 * TERMINAL: a zsh-style log of what actually ran: this pipeline's steps (scan, plan, key generation,
 * sign/verify, ledger appends) and the server's bus for the same kinds of work. Autoscrolls, lights
 * the lines that belong to the stage on screen, and ends in a blinking block cursor.
 */
import { useEffect, useRef } from "react";
import { useLiveEvents } from "@/lib/client/live";
import { usePipeline } from "@/lib/client/pipeline";
import { ms } from "@/lib/format";
import type { OpEvent } from "@/lib/live/types";
import { HudPanel } from "./HudPanel";

const relevant = (e: OpEvent) =>
  e.site?.startsWith("pipeline-") ||
  e.source === "scanner" ||
  (e.source === "ledger" && e.op !== "LEDGER") ||
  e.source === "kms" ||
  e.source === "policy";

const OP_TONE: Partial<Record<OpEvent["op"], string>> = {
  REJECT: "text-danger",
  VERIFY: "text-ok",
  SIGN: "text-sig",
  LEDGER: "text-sig",
  HANDSHAKE: "text-kem",
  KEYGEN: "text-kem",
  SCAN: "text-warn",
};

const clock = (at: number) => new Date(at).toTimeString().slice(0, 8);

export function Terminal({ className = "" }: { className?: string }) {
  const lines = useLiveEvents(relevant, 80);
  const stage = usePipeline((s) => s.stage);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);
  return (
    <HudPanel
      label="Terminal"
      right={<span className="font-mono text-micro uppercase text-fg-3">zsh · live bus</span>}
      className={className}
    >
      <div
        ref={box}
        role="log"
        aria-label="Pipeline terminal"
        className="h-full overflow-y-auto px-3 py-2 font-mono text-micro leading-5"
      >
        {lines.map((e) => {
          const mine = e.site === `pipeline-${stage}`;
          return (
            <p
              key={`${e.source}-${e.seq}`}
              className={`whitespace-pre-wrap break-all ${mine ? "bg-raised text-fg" : "text-fg-2"}`}
              data-term-stage={e.site?.replace("pipeline-", "")}
            >
              <span className="text-ok">➜ </span>
              <span className="text-fg-3">{clock(e.at)} </span>
              <span className={OP_TONE[e.op] ?? "text-fg-2"}>{e.op.padEnd(9)}</span>
              {e.detail}
              {e.ms > 0 && <span className="text-fg-3"> · {ms(e.ms)}</span>}
            </p>
          );
        })}
        <p className="text-fg-2">
          <span className="text-ok">➜ </span>
          <span className="text-fg-3">~/quantumledger </span>
          <span aria-hidden className="inline-block h-3 w-2 animate-blink bg-fg align-middle" />
        </p>
      </div>
    </HudPanel>
  );
}
