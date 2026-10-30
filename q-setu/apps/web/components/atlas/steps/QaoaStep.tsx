"use client";

/**
 * Wave selection (QAOA): qaoa.table rendered generically: metrics when status == "ok", otherwise Atlas's
 * status_text (never zero-filled). Live backend status from /quantum/status, with Atlas's blocker text.
 * No quantum advantage is claimed: QAOA is a measured cross-check against the exact optimum.
 */
import { useState } from "react";
import { AtlasError, atlas, type QaoaRow } from "@/lib/client/atlas";
import { useAtlas, useAtlasMe } from "@/lib/client/useAtlas";
import {
  AtlasErrorPanel,
  Chip,
  Honesty,
  KeyStats,
  NotYetRun,
  Part,
  Skeleton,
  Table,
} from "../AtlasUI";
import { fmt, pct, useResults } from "../useResults";

function QuantumStatusPanel({ ws }: { ws: string }) {
  const me = useAtlasMe();
  const st = useAtlas(me.user ? "quantum-status" : null, (signal) =>
    atlas.quantumStatus({ signal }),
  );
  const [run, setRun] = useState<{ busy: boolean; out?: Record<string, unknown>; err?: string }>({
    busy: false,
  });
  if (!me.user)
    return <p className="text-small text-fg-3">Sign in to see the live QpiAI backend status.</p>;
  if (st.error) return <AtlasErrorPanel error={st.error} onRetry={st.reload} />;
  if (!st.data) return <Skeleton className="h-24" />;
  const s = st.data;
  return (
    <div className="space-y-3">
      <p className="text-small text-fg-2">
        Backend: <span className="text-fg">{s.backend}</span> · QpiAI SDK {s.cloud.sdk_version} ·
        cloud login{" "}
        {s.cloud.reachable
          ? `ok, ${s.cloud.devices.filter((d) => d.status === "active").length} devices active`
          : `failed: ${s.cloud.error ?? "unknown"}`}
      </p>
      {s.fallback_reason && (
        <Honesty kind="blocked" short="QCloud jobs disabled">
          {s.fallback_reason}
        </Honesty>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={run.busy}
          onClick={async () => {
            setRun({ busy: true });
            try {
              setRun({ busy: false, out: await atlas.quantumRun(ws, 1) });
            } catch (e) {
              setRun({ busy: false, err: e instanceof AtlasError ? e.message : "run failed" });
            }
          }}
          className="h-10 rounded-sm border border-line-strong px-4 font-mono text-micro uppercase text-fg hover:bg-raised disabled:opacity-40"
        >
          {run.busy ? "Running QAOA…" : "Run QAOA now (p = 1)"}
        </button>
        {run.err && (
          <span role="alert" className="text-small text-danger">
            {run.err}
          </span>
        )}
        {run.out && (
          <span className="text-small text-fg-2">
            {String(run.out.backend)} · {fmt(run.out.n_variables)} qubits · feasible{" "}
            {pct(run.out.feasible_fraction)} · P(optimal set) {pct(run.out.p_optimal_assets)} · not
            signed (live demo run)
          </span>
        )}
      </div>
    </div>
  );
}

/** The metric columns of Atlas's QAOA table (viz/data.js QAOA_COLUMNS), in its order. */
const COLS: [string, string][] = [
  ["feasible_fraction", "Feasible"],
  ["approximation_ratio", "Approx. ratio"],
  ["energy_ratio", "Energy ratio"],
  ["p_optimal", "P(opt)"],
  ["p_optimal_assets", "P(opt set)"],
];

export function QaoaStep() {
  const { ws, results, error, loading, reload } = useResults();
  if (error) return <AtlasErrorPanel error={error} onRetry={reload} />;
  if (loading && results === undefined) return <Skeleton className="mt-10 h-console" />;
  if (!results) return <NotYetRun what="Wave selection" />;
  const q = results.qaoa as unknown as {
    table?: QaoaRow[];
    problem?: { n_variables?: number; week?: number; assets?: string[] };
    exact?: { assets?: string[]; objective?: number };
    run_id?: string;
  } | null;
  const levels = (q?.table ?? []).filter(
    (r) => r.source === "local" && r.status === "ok" && r.metrics,
  );
  const top = [...levels].sort((x, y) => (y.p ?? 0) - (x.p ?? 0))[0];
  const rnd = (q?.table ?? []).find((r) => r.source === "random" && r.status === "ok" && r.metrics);
  const tm = (top?.metrics ?? {}) as Record<string, number | undefined>;
  const rm = (rnd?.metrics ?? {}) as Record<string, number | undefined>;
  return (
    <>
      {q?.table && top && (
        <Part title="Wave selection at a glance">
          <KeyStats
            items={[
              {
                label: "systems in this choice",
                value: fmt(q.problem?.assets?.length),
                unit: `week ${fmt(q.problem?.week)} · ${fmt(q.problem?.n_variables)} QUBO variables`,
              },
              {
                label: `feasible share · p = ${top.p}`,
                value: fmt(tm.feasible_fraction, 4),
                unit: `random baseline ${fmt(rm.feasible_fraction, 4)}`,
              },
              {
                label: `P(optimal set) · p = ${top.p}`,
                value: fmt(tm.p_optimal_assets, 4),
                unit: `random baseline ${fmt(rm.p_optimal_assets, 4)}`,
              },
            ]}
          />
        </Part>
      )}
      <Part
        title="QAOA against the exact answer"
        label={q?.run_id ? `run ${q.run_id.slice(0, 12)}` : undefined}
      >
        {!q || !q.table ? (
          <p className="text-body text-fg-2">
            QAOA: not run for this workspace (nothing to migrate, or the step was skipped).
          </p>
        ) : (
          <>
            <p className="mb-4 text-body text-fg-2">
              Week {fmt(q.problem?.week)} choice, {fmt(q.problem?.n_variables)} QUBO variables.
              Exact optimum (brute force):{" "}
              <span className="text-fg">{q.exact?.assets?.join(", ") || "–"}</span>.
            </p>
            <Table
              caption="QAOA rows by depth and backend"
              head={["p", "Source", "Backend", "Shots", ...COLS.map(([, l]) => l), "Status"]}
              rows={q.table.map((row) => {
                const ok = row.status === "ok" && row.metrics;
                const m = (row.metrics ?? {}) as Record<string, number | undefined>;
                return [
                  row.p ?? "–",
                  row.source,
                  <span key="b" className="text-micro">
                    {row.backend}
                  </span>,
                  ok ? fmt(row.shots) : "",
                  // Atlas (viz/data.js qaoaModel): metrics to 4 decimals for ok rows, status_text otherwise.
                  ...COLS.map(([k]) => (ok ? fmt(m[k], 4) : "")),
                  ok ? (
                    <span key="s" className="text-small">
                      <Chip status="ok">measured</Chip>{" "}
                      <span className="font-mono text-micro text-fg-3">
                        {row.job_ids.length ? `job ${row.job_ids.join(", ")}` : "no job ID (local)"}
                      </span>
                    </span>
                  ) : (
                    <span key="t" className="text-small text-fg-3">
                      {row.status_text ?? row.status}
                    </span>
                  ),
                ];
              })}
            />
          </>
        )}
        <div className="mt-4">
          <Honesty kind="simulation" short="simulators; a cross-check, no quantum advantage">
            QAOA runs on simulators (plus any recorded IBM hardware rows); it is a measured
            cross-check against the exact optimum. No quantum advantage is claimed.
          </Honesty>
        </div>
      </Part>
      <Part title="Live quantum backend" label="QpiAI">
        <QuantumStatusPanel ws={ws} />
      </Part>
    </>
  );
}
