"use client";

/**
 * Tie-break priority (python -m tiebreak, after Plan): inside each wave, the order in which batches get their
 * ML-KEM / ML-DSA patches when vulnerability scores tie. One line "why first" per batch; the full reasoning
 * (every key, Mosca's numbers) in a closed dropdown. Keys, kinds and the Q-day choice are assumptions.
 */
import {
  AtlasErrorPanel,
  Chip,
  Details,
  Honesty,
  KeyStats,
  NotYetRun,
  Part,
  Skeleton,
} from "../AtlasUI";
import { fmt, useResults } from "../useResults";

type Batch = {
  rank: number;
  id: string;
  name?: string;
  score: number;
  uses: string[];
  patches: string[];
  decided_by: string;
  why: string;
  tie: { size: number; position: number; with: string[]; dependency_cycle: boolean } | null;
  mosca: {
    x_shelf_life_years: number;
    y_migration_years: number;
    z_years_to_qday: number;
    exposed: boolean;
  };
  keys: Record<string, number | string>;
};
type Section = {
  run_id: string;
  method: string;
  keys: { key: string; label: string }[];
  threat: { scenario: string; z_years_to_qday: number; rule: string };
  patch_rule: { note: string };
  tie_groups: number;
  dependency_cycles: number;
  waves: { week: number; batches: Batch[] }[];
};

const short = (p: string) => p.split(" ")[0];

export function TiebreakStep() {
  const { results, error, loading, reload } = useResults();
  if (error) return <AtlasErrorPanel error={error} onRetry={reload} />;
  if (loading && results === undefined) return <Skeleton className="mt-10 h-console" />;
  const t = (results as unknown as { tiebreak?: Section | null } | null)?.tiebreak;
  if (!results || !t)
    return (
      <NotYetRun
        what="Tie-break priority"
        hint="This workspace's results predate the tie-break stage: run the pipeline again."
      />
    );
  const n = t.waves.reduce((k, w) => k + w.batches.length, 0);
  const tied = t.waves.flatMap((w) => w.batches).filter((b) => b.tie).length;
  return (
    <>
      <Part title="Tie-break priority" label={`run ${t.run_id.slice(0, 12)}`}>
        <p className="mb-6 max-w-text text-body text-fg-2">
          Which batch in a wave gets its post-quantum patch first when scores tie.
        </p>
        <KeyStats
          items={[
            {
              label: "tie groups resolved",
              value: fmt(t.tie_groups),
              unit: `${fmt(tied)} of ${fmt(n)} batches were tied`,
            },
            {
              label: "Q-day for Mosca's margin",
              value: t.threat.scenario,
              unit: `z = ${fmt(t.threat.z_years_to_qday, 2)} years (${t.threat.rule} scenario)`,
            },
            {
              label: "dependency cycles broken",
              value: fmt(t.dependency_cycles),
              unit: "by the keys, recorded",
            },
          ]}
        />
        <Details summary="How the order is decided">
          <p>
            Inside each wave of the plan, batches go in order of vulnerability score. When scores
            tie, a batch that another tied batch depends on goes first; then, in order:
          </p>
          <ol className="list-decimal space-y-1 pl-6">
            {t.keys.map((k) => (
              <li key={k.key}>{k.label}</li>
            ))}
          </ol>
          <p>
            Mosca&apos;s inequality: data that must stay secret x years, migrated y years from now,
            is exposed if x + y &gt; z (years to Q-day). A larger margin x + y − z goes first.
          </p>
          <p>{t.patch_rule.note}</p>
          <Honesty kind="assumption">
            The key order, the internet-facing kinds and the choice of the earliest Q-day scenario
            come from config/tiebreak.json; the vulnerability score is Atlas&apos;s risk weight.
          </Honesty>
        </Details>
      </Part>
      {t.waves.map((w) => (
        <Part
          disclosure
          key={w.week}
          title={`Week ${w.week}`}
          label={`${w.batches.length} ${w.batches.length === 1 ? "batch" : "batches"}`}
        >
          <ol className="space-y-2">
            {w.batches.map((b) => (
              <li key={b.id} className="rounded-lg border border-line p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="tabular font-mono text-micro text-fg-3">#{b.rank}</span>
                  <span className="text-body text-fg">{b.name ?? b.id}</span>
                  <span className="font-mono text-micro text-fg-3">score {fmt(b.score, 1)}</span>
                  {b.tie && <Chip status="partially_verified">{`tie of ${b.tie.size}`}</Chip>}
                  <span className="ml-auto flex flex-wrap gap-1">
                    {b.patches.map((p, i) => (
                      <Chip key={p} status="hybrid">
                        {i + 1}. {short(p)}
                      </Chip>
                    ))}
                  </span>
                </div>
                <p className="mt-2 text-small text-fg-2">Why: {b.why}</p>
                <Details summary="Full reasoning">
                  <p>
                    Decided by: <span className="text-fg">{b.decided_by.replaceAll("_", " ")}</span>
                    {b.tie
                      ? ` · position ${b.tie.position} of ${b.tie.size}, tied with ${b.tie.with.join(", ")}`
                      : ""}
                    {b.tie?.dependency_cycle
                      ? " · a dependency cycle in this group was broken by the keys"
                      : ""}
                  </p>
                  <p>
                    Mosca: x = {fmt(b.mosca.x_shelf_life_years, 2)} y shelf life, y ={" "}
                    {fmt(b.mosca.y_migration_years, 3)} y to migrate, z ={" "}
                    {fmt(b.mosca.z_years_to_qday, 2)} y to Q-day:{" "}
                    {b.mosca.exposed ? "exposed (x + y > z)" : "not exposed (x + y ≤ z)"}
                  </p>
                  <p>
                    Uses:{" "}
                    {b.uses.length
                      ? b.uses
                          .map((u) => (u === "kex" ? "key exchange" : "signatures"))
                          .join(" and ")
                      : "–"}
                    ; patches in order: {b.patches.join(" → ") || "–"}
                  </p>
                  <dl className="grid grid-cols-entry gap-x-4 gap-y-1 font-mono text-micro">
                    {t.keys.map((k) => (
                      <div key={k.key} className="contents">
                        <dt className="text-fg-3">{k.label}</dt>
                        <dd className="text-fg">{String(b.keys[k.key])}</dd>
                      </div>
                    ))}
                  </dl>
                </Details>
              </li>
            ))}
          </ol>
        </Part>
      ))}
    </>
  );
}
