"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Panel } from "@/components/ui";
import { Copy } from "@/components/ui/Copy";
import type { AgentResult, BenchmarkReport } from "@/lib/lab/types";
import { Chip } from "./ui";

interface Loaded {
  running: boolean;
  job?: { id: string; status: string; done: number; total: number; agents: string[] };
  report?: BenchmarkReport & { seq: number; hash: string; signed: boolean; verified: boolean };
  key: { alg: string; keyId: string };
}

/** Plain summary: what Shield stopped, what it only slowed, and what still got through. */
function summaryLine(r: BenchmarkReport): string {
  const t = r.totals;
  const parts = [`Shield blocked ${t.blocked} of ${t.sent} attack requests`];
  if (t.slowed) parts.push(`slowed ${t.slowed}`);
  if (t.challenged) parts.push(`challenged ${t.challenged}`);
  const gotIn = r.agents.filter((a) => a.protected.goalReached).map((a) => a.label);
  parts.push(
    t.gotThrough === 0
      ? "nothing got through"
      : `${t.gotThrough} got through${gotIn.length ? ` — ${gotIn.join(" and ")} still reached ${gotIn.length > 1 ? "their goals" : "its goal"}` : ""}`,
  );
  return parts.join(", ") + ".";
}

function AgentRow({ a }: { a: AgentResult }) {
  const u = a.unprotected;
  const p = a.protected;
  return (
    <Panel as="article">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-body font-medium text-fg">{a.label}</h3>
          <p className="mt-1 text-small text-fg-2">{a.goal}</p>
        </div>
        <span className="text-small">
          <span className="font-mono text-label uppercase text-fg-3">Resilience </span>
          <span
            className={
              a.resilience >= 80 ? "text-ok" : a.resilience >= 40 ? "text-warn" : "text-danger"
            }
          >
            {a.resilience}/100
          </span>
        </span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-warn p-4">
          <p className="font-mono text-label uppercase text-fg-3">
            <Copy simple="Unprotected" technical="Bare legacy bank" />
          </p>
          <p className="mt-2 text-h3 font-medium text-warn">
            {u.gotThrough}/{u.sent} got through
          </p>
          <p className="mt-1 text-small text-fg-2">
            <Copy
              simple={u.goalReached ? "The attack succeeded." : "The attack did not fully succeed."}
              technical={`served ${u.served} · goal ${u.goalReached ? "reached" : "denied"} · no PQC handshake`}
            />
          </p>
        </div>
        <div className="rounded-lg border border-ok p-4">
          <p className="font-mono text-label uppercase text-fg-3">
            <Copy simple="PQC + Shield" technical="Behind PQC + Shield (protect mode)" />
          </p>
          <p className={`mt-2 text-h3 font-medium ${p.gotThrough === 0 ? "text-ok" : "text-warn"}`}>
            {p.gotThrough}/{p.sent} got through
          </p>
          <p className="mt-1 text-small text-fg-2">
            <Copy
              simple={
                (p.blocked ? `Blocked ${p.blocked}. ` : "") +
                (p.slowed ? `Slowed ${p.slowed}. ` : "") +
                (p.challenged ? `Challenged ${p.challenged}. ` : "") +
                (p.goalReached ? "The attack still reached its goal." : "The attack was stopped.")
              }
              technical={`blocked ${p.blocked} · slowed ${p.slowed} · challenged ${p.challenged} · allowed ${p.allowed}${p.firstBlockMs !== null ? ` · first block ${(p.firstBlockMs / 1000).toFixed(1)} s` : ""} · ${p.quantumSafe ? "PQC handshake" : "no handshake"}`}
            />
          </p>
        </div>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-small text-fg-3">
        {p.quantumSafe && <Chip tone="kem">quantum-safe</Chip>}
        {p.goalReached ? <Chip tone="warn">got through</Chip> : <Chip tone="ok">held</Chip>}
        <span>{a.note}</span>
      </p>
    </Panel>
  );
}

/** Team only. Runs the resilience benchmark through /api/lab/benchmark; the engine does all the work. */
export function BenchmarkRunner() {
  const [data, setData] = useState<Loaded>();
  const [error, setError] = useState<string>();
  const poll = useRef<ReturnType<typeof setInterval>>(undefined);

  const load = async () => {
    try {
      const r = await fetch("/api/lab/benchmark", { cache: "no-store" });
      const j = (await r.json()) as Loaded & { error?: { message: string } };
      if (!r.ok) setError(j.error?.message ?? "Couldn't reach the benchmark.");
      else {
        setData(j);
        setError(undefined);
      }
      return j;
    } catch {
      setError("Couldn't reach the benchmark.");
      return undefined;
    }
  };

  useEffect(() => {
    void load();
    return () => clearInterval(poll.current);
  }, []);

  const run = async () => {
    setError(undefined);
    const r = await fetch("/api/lab/benchmark", { method: "POST" });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: { message: string } };
      setError(j.error?.message ?? "Couldn't start the benchmark.");
      return;
    }
    clearInterval(poll.current);
    poll.current = setInterval(async () => {
      const j = await load();
      if (j && !j.running) clearInterval(poll.current);
    }, 700);
  };

  const running = data?.running;
  const job = data?.job;
  const report = data?.report;

  return (
    <>
      <Panel className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="primary" onClick={run} disabled={running}>
            {running ? `Running ${job?.done ?? 0}/${job?.total ?? 0}…` : "Run benchmark"}
          </Button>
          {report && (
            <span className="text-small text-fg-3">
              <Copy
                simple={
                  report.verified
                    ? "Last report is tamper-proof (signed and checked)."
                    : "Last report is signed."
                }
                technical={`record #${report.seq} · ${data?.key.alg} · verified ${report.verified}`}
              />
            </span>
          )}
        </div>
        {running && (
          <span className="mt-4 block h-1 overflow-hidden rounded-full bg-line" aria-hidden>
            <span
              className="block h-full bg-kem transition-all duration-300"
              style={{ width: `${job ? (100 * job.done) / Math.max(1, job.total) : 0}%` }}
            />
          </span>
        )}
        <p className="mt-4 text-small text-fg-3">
          <Copy
            simple="Runs on this computer only: the agents attack two practice copies of a bank site (one bare, one behind PQC + Shield). They refuse any target that isn't on this machine."
            technical="The engine starts a fresh loopback sandbox pair and runs the Lab's attacker agents against both; every request is routed through the host guard (loopback only). The run also feeds the live Lab, training the model and filling the attack map."
          />
        </p>
        {error && (
          <p role="status" className="mt-3 text-small text-danger">
            {error}
          </p>
        )}
      </Panel>

      {report && (
        <>
          <Panel className="mb-6">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2 className="text-h3 font-medium text-fg">
                <Copy simple="How well it held" technical="Overall resilience" />
              </h2>
              <span className="text-h2 font-medium text-fg">
                {report.overallResilience}
                <span className="text-body text-fg-3">/100</span>
              </span>
            </div>
            <p className="mt-2 max-w-prose text-body text-fg-2">{summaryLine(report)}</p>
            <p className="mt-2 text-small text-fg-3">
              <Copy
                simple={`The protected copy negotiated a real quantum-safe handshake (${report.handshake.group}) in ${report.handshake.ms} ms. The bare copy had none.`}
                technical={`Handshake: X25519 + ML-KEM-768, ML-DSA-65-signed · ${report.handshake.ms} ms · ok ${report.handshake.ok}`}
              />
            </p>
          </Panel>

          <div className="flex flex-col gap-6">
            {report.agents.map((a) => (
              <AgentRow key={a.id} a={a} />
            ))}
          </div>

          <details className="mt-8 border-t border-line pt-6">
            <summary className="cursor-pointer text-small text-fg-3">
              <Copy simple="What this proves and what it doesn't" technical="Method and limits" />
            </summary>
            <div className="mt-4 max-w-prose text-small text-fg-2">
              <p>{report.caveat}</p>
              <p className="mt-3 text-fg-3">{report.method}</p>
            </div>
          </details>
        </>
      )}
    </>
  );
}
