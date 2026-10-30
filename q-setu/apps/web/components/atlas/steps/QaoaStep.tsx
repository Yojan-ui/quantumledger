"use client";

/**
 * Wave selection (QAOA): qaoa.table rendered generically: metrics when status == "ok", otherwise Atlas's
 * status_text (never zero-filled). Live backend status from /quantum/status, with Atlas's blocker text.
 * No quantum advantage is claimed: QAOA is a measured cross-check against the exact optimum.
 */
import { useState } from "react";
import { AtlasError, atlas, type QaoaRow } from "@/lib/client/atlas";
import { useAtlas, useAtlasMe } from "@/lib/client/useAtlas";
import { AtlasErrorPanel, Chip, Honesty, NotYetRun, Part, Skeleton, Table } from "../AtlasUI";
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
      {s.fallback_reason && <Honesty kind="blocked">{s.fallback_reason}</Honesty>}
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
  return (
    <>
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
              head={[
                "p",
                "Source",
                "Backend",
                "Status",
                "Feasible share",
                "P(optimal set)",
                "Approx. ratio",
                "Job IDs",
              ]}
              rows={q.table.map((row) => {
                const ok = row.status === "ok" && row.metrics;
                const m = row.metrics as {
                  feasible_fraction?: number;
                  p_optimal_assets?: number;
                  approximation_ratio?: number;
                } | null;
                return [
                  row.p ?? "–",
                  row.source,
                  <span key="b" className="text-micro">
                    {row.backend}
                  </span>,
                  <Chip key="s" status={row.status} />,
                  ...(ok
                    ? [
                        pct(m?.feasible_fraction),
                        pct(m?.p_optimal_assets),
                        fmt(m?.approximation_ratio, 3),
                      ]
                    : [
                        <span key="t" className="text-fg-3">
                          {row.status_text ?? row.status}
                        </span>,
                        "",
                        "",
                      ]),
                  row.job_ids.length ? (
                    <span key="j" className="font-mono text-micro">
                      {row.job_ids.join(", ")}
                    </span>
                  ) : (
                    "none (local)"
                  ),
                ];
              })}
            />
          </>
        )}
        <div className="mt-4">
          <Honesty kind="simulation">
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
