"use client";

/**
 * Plan: the QpiAI Opt MILP wave plan against first-come-first-served and greedy on the same data, per
 * Q-day scenario (exposure-years still readable after Q-day; lower is better). Assumptions labelled.
 */
import { MiniStat } from "@/components/ui/Stat";
import {
  AtlasErrorPanel,
  Chip,
  Details,
  Honesty,
  KeyStats,
  NotYetRun,
  Part,
  Skeleton,
  Table,
} from "../AtlasUI";
import { fmt, useResults } from "../useResults";
import { PlannerComparison } from "./PlannerComparison";

type Scen = {
  scenario: string;
  year?: number;
  exposure_years?: number;
  weighted_exposure?: number;
};
type Plan = {
  per_scenario?: Scen[];
  expected_weighted?: number;
  makespan_weeks?: number;
  waves?: { week: number; assets: string[]; effort_days?: number }[];
};
type Avoided = { scenario: string; exposure_years_avoided: number; weighted_avoided: number };
type Run = {
  stage?: string;
  solver?: string;
  status?: string;
  solver_time_s?: number;
  run_id?: string;
  job_id?: string | null;
  job_id_reason?: string | null;
};

export function ScheduleStep() {
  const { ws, results, error, loading, reload } = useResults();
  if (error) return <AtlasErrorPanel error={error} onRetry={reload} />;
  if (loading && results === undefined) return <Skeleton className="mt-10 h-console" />;
  if (!results) return <NotYetRun what="Plan" />;
  const r = results as unknown as {
    exposure: Plan;
    baselines: { fcfs: Plan; greedy: Plan };
    avoided: { vs_fcfs: Avoided[]; vs_greedy: Avoided[] };
    solver_runs: Run[];
    assumptions: {
      capacity_days_per_week?: number;
      start_year?: number;
      horizon_weeks?: number;
      scenarios?: { name: string; year: number; weight: number }[];
    };
    assets: unknown[];
  };
  if (r.assets.length === 0)
    return (
      <Part title="Plan">
        {<p className="text-body text-fg-2">Nothing to migrate: no RSA / ECC / DH found.</p>}
      </Part>
    );
  const scen = (r.exposure.per_scenario ?? []).map((s) => s.scenario);
  const av = (l: Avoided[], sc: string) => l.find((x) => x.scenario === sc);
  const first = scen[0]; // Atlas's Plan page opens on the first scenario
  const main =
    r.solver_runs.find((x) => x.stage?.endsWith(".expected.expected")) ?? r.solver_runs[0];
  return (
    <>
      <Part title="Plan at a glance" label={`Q-day scenario ${first ?? "–"}`}>
        <KeyStats
          items={[
            {
              label: "weeks to migrate",
              value: fmt(r.exposure.makespan_weeks),
              unit: "optimised plan",
            },
            {
              label: "exposure avoided vs first-come-first-served",
              value: fmt(av(r.avoided.vs_fcfs, first ?? "")?.exposure_years_avoided, 3),
              unit: "exposure-years",
            },
            {
              label: "exposure avoided vs greedy",
              value: fmt(av(r.avoided.vs_greedy, first ?? "")?.exposure_years_avoided, 3),
              unit: "exposure-years",
            },
          ]}
        />
      </Part>
      <Part title="Effort per wave vs team capacity" label="the real plan">
        <Table
          caption="Effort per wave against weekly capacity"
          head={["Week", "Systems", "Effort (engineer-days)", "Capacity (assumption)", "Use"]}
          rows={(r.exposure.waves ?? []).map((w) => [
            fmt(w.week),
            w.assets.length,
            fmt(w.effort_days, 1),
            fmt(r.assumptions.capacity_days_per_week),
            r.assumptions.capacity_days_per_week
              ? `${fmt(((w.effort_days ?? 0) / r.assumptions.capacity_days_per_week) * 100)} %`
              : "–",
          ])}
        />
      </Part>
      <Part disclosure title="Wave plan" label={`${fmt(r.exposure.makespan_weeks)} weeks`}>
        <ol className="grid gap-2 md:grid-cols-2">
          {(r.exposure.waves ?? []).map((w) => (
            <li key={w.week} className="rounded-lg border border-line px-4 py-3">
              <span className="font-mono text-micro uppercase text-fg-3">Week {w.week}</span>
              <p className="mt-1 text-small text-fg">{w.assets.join(", ")}</p>
              <p className="font-mono text-micro text-fg-3">
                {fmt(w.effort_days, 1)} engineer-days
              </p>
            </li>
          ))}
        </ol>
      </Part>
      <PlannerComparison ws={ws} results={results as unknown as Record<string, unknown>} />
      <Part
        disclosure
        title="Solver run"
        label={main?.run_id ? `run ${main.run_id.slice(0, 12)}` : undefined}
      >
        {main ? (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <MiniStat value={main.solver ?? "–"} label="solver" />
            <MiniStat
              value={
                <Chip status={main.status === "optimal" ? "ok" : "FAIL"}>{main.status ?? "–"}</Chip>
              }
              label="status"
            />
            <MiniStat
              value={main.solver_time_s != null ? `${fmt(main.solver_time_s * 1000)} ms` : "–"}
              label="solve time"
            />
            <MiniStat value={main.job_id ?? "null"} label="job id" />
          </div>
        ) : (
          <p className="text-body text-fg-2">No solver run recorded.</p>
        )}
        {main?.job_id_reason && (
          <Details summary="Why job id is null">
            <p>{main.job_id_reason}</p>
          </Details>
        )}
      </Part>
      <Part title="Assumptions" label="config/assumptions.json">
        <Honesty
          kind="assumption"
          short={`capacity ${fmt(r.assumptions.capacity_days_per_week)} engineer-days/week, Q-day ${(r.assumptions.scenarios ?? []).map((s) => s.year).join(" / ")}`}
        >
          Start {fmt(r.assumptions.start_year)}, capacity{" "}
          {fmt(r.assumptions.capacity_days_per_week)} engineer-days per week, horizon{" "}
          {fmt(r.assumptions.horizon_weeks)} weeks. Q-day scenarios:{" "}
          {(r.assumptions.scenarios ?? []).map((s) => `${s.year} (weight ${s.weight})`).join(", ")}.
          Risk, effort and shelf-life values are assumptions.
        </Honesty>
      </Part>
    </>
  );
}
