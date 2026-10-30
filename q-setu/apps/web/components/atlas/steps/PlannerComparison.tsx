"use client";

/**
 * Every algorithm Atlas uses for wave planning, side by side, from Atlas's own numbers only:
 *  1. the full schedule: QpiAI Opt MILP vs first-come-first-served vs greedy (results.json exposure/baselines);
 *  2. one week's wave selection: QAOA (numpy and QpiAI QSV-Local) vs the exact optimum vs random (results.qaoa);
 *  3. the benchmark: exact, MILP, random, QAOA, hybrid on the same link-cutover instances (bench.json, signed in).
 * "Best" is marked per table by a rule stated next to it. Simulated and assumption labels stay visible.
 */
import { atlas } from "@/lib/client/atlas";
import { useAtlas, useAtlasMe } from "@/lib/client/useAtlas";
import { Chip, Honesty, Part, Table } from "../AtlasUI";
import { fmt } from "../useResults";

type Scen = { scenario: string; year?: number; exposure_years?: number };
type Plan = {
  per_scenario?: Scen[];
  expected_weighted?: number;
  worst_case_weighted?: number;
  makespan_weeks?: number;
};
type Run = { stage?: string; solver_time_s?: number; termination?: string; guarantee?: string };
type QRow = {
  p: number | null;
  source: string;
  backend: string;
  status: string;
  status_text: string | null;
  metrics: Record<string, number> | null;
};
type BRow = {
  n_variables: number;
  solver: string;
  family: string;
  p: number | null;
  status: string;
  status_text?: string | null;
  approximation_ratio: number | null;
  runtime_s: number | null;
  guarantee: string;
  p_optimal_assets: number | null;
};

const Best = () => (
  <>
    {" "}
    <span className="ml-2">
      <Chip status="ok">best</Chip>
    </span>
  </>
);

export function PlannerComparison({
  ws,
  results,
}: {
  ws: string;
  results: Record<string, unknown>;
}) {
  const me = useAtlasMe();
  const bench = useAtlas(me.user ? `bench:${ws}:${me.user.username}` : null, (signal) =>
    atlas.bench(ws, { signal }),
  );
  const ex = results.exposure as Plan;
  const base = results.baselines as { fcfs: Plan; greedy: Plan };
  const runs = (results.solver_runs ?? []) as Run[];
  const main = runs.find((x) => x.stage?.endsWith(".expected.expected")) ?? runs[0];
  const scen = (ex.per_scenario ?? []).map((s) => s.scenario);
  const yearOf = (sc: string) => ex.per_scenario?.find((x) => x.scenario === sc)?.year ?? sc;
  const exp = (p: Plan, sc: string) =>
    p.per_scenario?.find((x) => x.scenario === sc)?.exposure_years;
  // Exposure-years avoided against first-come-first-served, per scenario: FCFS − plan (Atlas's own
  // results.avoided.vs_fcfs for the MILP; the same difference of Atlas's exposures for greedy).
  const avoided = (p: Plan, sc: string) => {
    const f = exp(base.fcfs, sc),
      x = exp(p, sc);
    return f !== undefined && x !== undefined ? f - x : undefined;
  };
  const plans: [string, Plan, string][] = [
    [
      "QpiAI Opt MILP",
      ex,
      main?.solver_time_s != null ? `${fmt(main.solver_time_s * 1000)} ms` : "–",
    ],
    ["Greedy (highest risk first)", base.greedy, "not recorded"],
    ["First-come-first-served", base.fcfs, "not recorded"],
  ];
  const bestPlan = Math.min(...plans.map(([, p]) => p.expected_weighted ?? Infinity));

  const q = results.qaoa as {
    table?: QRow[];
    problem?: { week?: number; n_variables?: number };
    exact?: { objective?: number };
  } | null;
  const qrows = (q?.table ?? []).filter((r) => r.status === "ok" && r.metrics);
  const bestP = Math.max(...qrows.map((r) => r.metrics!.p_optimal_assets ?? 0));

  const brows = ((bench.data?.bench as { rows?: BRow[] } | null)?.rows ?? []) as BRow[];
  const largest = brows.length ? Math.max(...brows.map((r) => r.n_variables)) : null;
  const atLargest = brows.filter((r) => r.n_variables === largest);
  const exactFastest = Math.min(
    ...atLargest
      .filter(
        (r) =>
          r.status === "ok" &&
          r.approximation_ratio === 1 &&
          /proven/.test(r.guarantee) &&
          r.runtime_s !== null,
      )
      .map((r) => r.runtime_s as number),
  );

  return (
    <Part title="Every planning algorithm, side by side" label="Atlas's recorded numbers">
      <h3 className="mb-3 font-mono text-micro uppercase text-fg-3">
        Full schedule · all {fmt((results.assets as unknown[]).length)} systems
      </h3>
      <Table
        caption="Full-schedule planners compared"
        head={[
          "Planner",
          "Weighted exposure (cost)",
          "Worst case",
          "Makespan",
          ...scen.map((s) => `Avoided vs FCFS · ${yearOf(s)}`),
          "Solve time",
          "Guarantee",
        ]}
        rows={plans.map(([name, p, t]) => [
          <span key="n" className="whitespace-nowrap text-fg">
            {name}
            {p.expected_weighted === bestPlan && name.startsWith("QpiAI") && <Best />}
          </span>,
          fmt(p.expected_weighted, 2),
          fmt(p.worst_case_weighted, 2),
          `${fmt(p.makespan_weeks)} wk`,
          ...scen.map((s) => fmt(avoided(p, s), 3)),
          t,
          name.startsWith("QpiAI")
            ? `${main?.termination ?? "–"} · ${main?.guarantee?.replaceAll("_", " ") ?? "–"}`
            : "heuristic, none",
        ])}
      />
      <p className="mt-2 text-small text-fg-3">
        Best = lowest weighted exposure. Greedy’s avoided exposure is computed from Atlas’s
        per-scenario exposures (FCFS − greedy).
      </p>

      <h3 className="mb-3 mt-10 font-mono text-micro uppercase text-fg-3">
        One week&apos;s wave selection · week {fmt(q?.problem?.week)} ·{" "}
        {fmt(q?.problem?.n_variables)} variables
      </h3>
      {qrows.length ? (
        <Table
          caption="Wave selection: QAOA against the exact optimum"
          head={[
            "Method",
            "p",
            "Found the optimum",
            "P(optimal set)",
            "Feasible share",
            "Approx. ratio",
          ]}
          rows={[
            [
              <span key="e" className="text-fg">
                Exact (brute force)
              </span>,
              "–",
              "yes (proven)",
              "1.0000",
              "–",
              "1.0000",
            ],
            ...qrows.map((r) => [
              <span key="m" className="text-fg">
                {r.source === "random"
                  ? "Random sampling"
                  : r.source === "qpiai_local"
                    ? "QAOA · QpiAI QSV-Local"
                    : r.source === "ibm"
                      ? `QAOA · ${r.backend} (real hardware)`
                      : "QAOA · numpy statevector"}
                {r.source !== "random" && r.metrics!.p_optimal_assets === bestP && <Best />}
              </span>,
              r.p ?? "–",
              r.metrics!.approximation_ratio === 1 ? "yes" : "no",
              fmt(r.metrics!.p_optimal_assets, 4),
              fmt(r.metrics!.feasible_fraction, 4),
              fmt(r.metrics!.approximation_ratio, 4),
            ]),
          ]}
        />
      ) : (
        <p className="text-body text-fg-2">Wave selection: not yet run.</p>
      )}
      <p className="mt-2 text-small text-fg-3">
        Best QAOA = highest P(optimal set). The exact optimum is the reference every sampler is
        scored against.
      </p>

      <h3 className="mb-3 mt-10 font-mono text-micro uppercase text-fg-3">
        Benchmark · same instances, every method{largest ? ` · ${largest} variables` : ""}
      </h3>
      {!me.user ? (
        <p className="text-small text-fg-3">Sign in to see the benchmark (bench.json).</p>
      ) : bench.data?.bench && atLargest.length ? (
        <Table
          caption="Benchmark at the largest instance"
          head={["Method", "Family", "Optimal?", "Gap to optimum", "Runtime", "Guarantee"]}
          rows={atLargest.map((r) => [
            <span key="m" className="text-fg">
              {r.solver}
              {r.p ? ` p=${r.p}` : ""}
              {r.runtime_s === exactFastest && <Best />}
            </span>,
            r.family,
            r.status !== "ok" ? (
              <span key="s" className="text-fg-3">
                {r.status_text ?? r.status}
              </span>
            ) : r.approximation_ratio === 1 ? (
              "found it"
            ) : (
              "no"
            ),
            r.status === "ok" && r.approximation_ratio !== null
              ? fmt(Math.max(0, 1 - r.approximation_ratio), 4)
              : "–",
            r.runtime_s !== null ? `${fmt(r.runtime_s, 4)} s` : "–",
            r.guarantee,
          ])}
        />
      ) : (
        <p className="text-body text-fg-2">
          {bench.data?.status_text ?? "Benchmark: not yet run (python -m bench)."}
        </p>
      )}
      {me.user && atLargest.length > 0 && (
        <p className="mt-2 text-small text-fg-3">Best = fastest method with a proven optimum.</p>
      )}
      <div className="mt-4 space-y-2">
        <Honesty kind="simulation">
          QAOA runs on simulators; it is a measured cross-check against the exact optimum, not a
          claim of quantum advantage. At these sizes random sampling also finds the optimum.
        </Honesty>
        <Honesty kind="assumption">
          Weighted exposure uses the risk weights, shelf lives and Q-day scenario weights in
          config/assumptions.json.
        </Honesty>
      </div>
    </Part>
  );
}
