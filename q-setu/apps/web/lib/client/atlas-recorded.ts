/**
 * The recorded demo run as terminal events, for visitors who are not signed in (they cannot open Atlas's
 * run log). Every line is read from results.json: the stage's own fields and its recorded timestamp, shown
 * as time since Detect started. Stages without a section in results.json get no line and stay idle.
 * The events have the same shape as Atlas's SSE events, so the HUD treats them exactly like a run.
 */
import type { AtlasResults, RunEvent, Stage } from "./atlas";

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const secs = (iso: unknown) => (typeof iso === "string" ? Date.parse(iso) / 1000 : NaN);
const n2 = (x: unknown) => (typeof x === "number" ? x.toFixed(2) : "–");
const n1 = (x: unknown) => (typeof x === "number" ? x.toFixed(1) : "–");
const short = (p: string) => p.replace(/ \(.*\)$/, "");

/** Lines and the recorded timestamp per stage id; null = no evidence for that stage in results.json. */
export function recordedLines(r: Any): Record<string, { ts: number; lines: string[] } | null> {
  const d = r.detect;
  const sr = (r.solver_runs ?? [])[0];
  const tb = r.tiebreak;
  const hs = r.handshake_evidence;
  const q = r.qaoa;
  const lv = r.ledger_verification;
  return {
    detect: d
      ? {
          ts: secs(d.ts),
          lines: [
            `scanned ${d.files_scanned} files: ${(d.findings ?? []).length} findings, ${d.summary?.vulnerable_findings ?? "–"} quantum-vulnerable (RSA / ECC / DH)`,
            ...(d.probes ?? []).map(
              (p: Any) =>
                `live probe ${p.service} ${p.endpoint}: group=${p.live?.group ?? "–"} cert=${p.live?.cert_algorithm ?? "–"}`,
            ),
            `inventory: ${d.inventory?.assets ?? (r.assets ?? []).length} systems to migrate`,
          ],
        }
      : null,
    ledger: r.ledger
      ? {
          ts: secs(d?.ts),
          lines: [`detect evidence signed into the Proof Chain (${r.ledger.alg ?? "ML-DSA-65"})`],
        }
      : null,
    schedule:
      sr && r.exposure
        ? {
            ts: secs(sr.ts),
            lines: [
              `${sr.solver} MILP: ${sr.termination}${sr.guarantee === "global_optimum" ? ", global optimum" : ""} (job_id null: local solve)`,
              `${r.exposure.makespan_weeks} weeks · weighted exposure ${n1(r.exposure.expected_weighted)} vs FCFS ${n1(r.baselines?.fcfs?.expected_weighted)}, greedy ${n1(r.baselines?.greedy?.expected_weighted)}`,
            ],
          }
        : null,
    tiebreak: tb
      ? {
          ts: secs(tb.ts),
          lines: [
            `${tb.tie_groups ?? 0} tie groups; patch order ${(tb.patch_rule?.order ?? []).join(" → ")}`,
            ...((tb.waves ?? []) as Any[])
              .slice(0, 2)
              .flatMap((w) =>
                ((w.batches ?? []) as Any[])
                  .slice(0, 2)
                  .map(
                    (b) =>
                      `week ${w.week} #${b.rank} ${b.id}: ${(b.patches ?? []).map(short).join(" + ")}`,
                  ),
              ),
          ],
        }
      : null,
    capture: hs
      ? {
          ts: secs(hs.ts),
          lines: ((hs.sessions ?? []) as Any[]).map(
            (s) =>
              `TLS 1.3 ${s.service_id}: ${s.negotiated_group}${/MLKEM/.test(s.negotiated_group) ? " (hybrid PQ)" : " (classical, HNDL-exposed)"}`,
          ),
        }
      : null,
    gates:
      r.gates && Array.isArray(r.waves)
        ? {
            ts: secs(r.gates.ts),
            lines: (r.waves as Any[]).map((w) => `wave week ${w.week}: ${w.status}`),
          }
        : null,
    qaoa: q
      ? {
          ts: secs(q.ts),
          lines: ((q.table ?? []) as Any[]).map(
            (x) =>
              `p=${x.p} ${x.source}: ${x.status === "ok" ? `approximation ratio ${n2(x.metrics?.approximation_ratio)}${x.source === "ibm" ? " (IBM hardware)" : " (simulated)"}` : (x.status_text ?? x.status)}`,
          ),
        }
      : null,
    seal: lv
      ? {
          ts: secs(lv.ts),
          lines: [
            `${lv.entries_checked} entries checked: ${lv.ok ? "chain verified" : "VERIFICATION FAILED"} (ML-DSA-65)`,
            `Merkle root ${String(lv.root ?? "").slice(0, 16)}…`,
          ],
        }
      : null,
    report: r.generated_at
      ? {
          ts: secs(r.generated_at),
          lines: [`results.json assembled and validated (${r.generated_at})`],
        }
      : null,
  };
}

/** Synthetic run events (same shape as Atlas SSE) for the recorded run; `ts` paces the replay. */
export function recordedRunEvents(results: AtlasResults, stages: Stage[]): RunEvent[] {
  const rec = recordedLines(results as unknown as Any);
  const t0 = rec.detect?.ts ?? NaN;
  const evs: RunEvent[] = [];
  let seq = 0;
  let t = 0;
  const push = (e: Omit<RunEvent, "seq" | "ts">, dt: number) => {
    t += dt;
    evs.push({ ...e, seq: seq++, ts: t } as RunEvent);
  };
  push({ type: "run_start" }, 0);
  for (const st of stages) {
    const r = rec[st.id];
    if (!r || !st.steps.length) continue;
    const first = st.steps[0]!;
    const at = Number.isFinite(r.ts) && Number.isFinite(t0) ? `+${Math.max(0, r.ts - t0)} s` : "";
    push({ type: "step_start", step: first }, 0.35);
    push(
      { type: "line", step: first, text: `── ${st.label}${at ? ` · recorded ${at}` : ""}` },
      0.2,
    );
    for (const line of r.lines) push({ type: "line", step: first, text: line }, 0.3);
    for (const step of st.steps) push({ type: "step_end", step, exit_code: 0 }, 0.05);
  }
  const ok = (results as unknown as Any).ledger_verification?.ok === true;
  push({ type: "run_end", status: ok ? "PASS" : "FAIL" }, 0.4);
  return evs;
}
