"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { ReplayStepResult } from "@qsetu/attack-lab";
import { PhaseChip } from "../../lib/ui";
import { post, usePoll, type Overview, type ReplayJob } from "../../lib/api";

const BARE_TONE = { served: "c-warn", "not found": "c-2", error: "c-3" } as const;
const PROT_TONE = {
  passed: "c-warn",
  blocked: "c-ok",
  challenged: "c-ok",
  limited: "c-ok",
  error: "c-3",
} as const;

function Side({
  label,
  r,
  tone,
}: {
  label: string;
  r: { status: number; ms: number; outcome: string };
  tone: string;
}) {
  return (
    <span className={`chip ${tone}`} aria-label={`${label}: ${r.outcome}, ${r.status}`}>
      <span className="dot" />
      {r.outcome} <span className="faint mono">{r.status || "—"}</span>
    </span>
  );
}

function Row({ s }: { s: ReplayStepResult }) {
  return (
    <tr>
      <td className="mono faint">{s.i + 1}</td>
      <td className="mono" style={{ overflowWrap: "anywhere" }}>
        <span className="faint">{s.method}</span> {s.route}
      </td>
      <td>
        <PhaseChip phase={s.phase} />
      </td>
      <td>
        <Side label="bare" r={s.bare} tone={BARE_TONE[s.bare.outcome]} />
      </td>
      <td>
        <Side label="protected" r={s.protected} tone={PROT_TONE[s.protected.outcome]} />
        {s.protected.signals.length > 0 && (
          <div className="signals">{s.protected.signals.join(" · ")}</div>
        )}
      </td>
    </tr>
  );
}

function Replay() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: ov } = usePoll<Overview>("/api/overview", 5000);
  const [incident, setIncident] = useState(params.get("incident") ?? "");
  const [jobId, setJobId] = useState<string | null>(params.get("job"));
  const [err, setErr] = useState<string>();
  const { data: job } = usePoll<ReplayJob>(jobId ? `/api/replays/${jobId}` : null, 700);

  useEffect(() => {
    if (!incident && ov?.incidents[0]) setIncident(ov.incidents[0].id);
  }, [ov, incident]);

  const start = async () => {
    setErr(undefined);
    try {
      const { id } = await post<{ id: string }>("/api/replay", { incidentId: incident });
      setJobId(id);
      router.replace(`/replay?incident=${incident}&job=${id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const steps = job?.steps ?? [];
  const n = (pick: (s: ReplayStepResult) => boolean) => steps.filter(pick).length;
  const reachedBare = n((s) => s.bare.outcome === "served");
  const refused = n((s) => ["blocked", "challenged", "limited"].includes(s.protected.outcome));
  const reachedProt = n((s) => s.protected.outcome === "passed");

  return (
    <>
      <h1>Replay</h1>
      <p className="lede">
        Sends a saved incident’s steps, in order and with its pacing, to two fresh copies of the
        legacy bank on this machine: one bare, one behind Shield. Only localhost targets are
        allowed; the runner refuses any other host.
      </p>

      <div className="panel panel-pad row" style={{ marginBottom: 24 }}>
        <label className="row pick" style={{ gap: 8 }}>
          <span className="muted">Incident</span>
          <select
            className="btn mono"
            value={incident}
            onChange={(e) => setIncident(e.target.value)}
          >
            {!ov?.incidents.length && <option value="">no incidents yet</option>}
            {ov?.incidents.map((i) => (
              <option key={i.id} value={i.id}>
                {i.id} · {i.pattern.name} · {i.steps} steps
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn primary"
          onClick={start}
          disabled={!incident || job?.status === "running"}
        >
          {job?.status === "running"
            ? `Replaying ${steps.length}/${job.total}…`
            : "Replay against sandbox"}
        </button>
        {incident && (
          <Link className="muted" href={`/incidents/${incident}`}>
            View timeline
          </Link>
        )}
        {err && <span className="c-danger">{err}</span>}
      </div>

      {job && (
        <>
          <div className="grid2" style={{ marginBottom: 16 }}>
            <section className="panel panel-pad tint-warn" aria-label="Bare">
              <div className="faint" style={{ fontSize: 12 }}>
                Bare legacy bank
              </div>
              <h2 className="c-warn" style={{ margin: "4px 0" }}>
                Answered {steps.length - n((s) => s.bare.outcome === "error")} of {steps.length}
              </h2>
              <p className="muted" style={{ margin: 0 }}>
                {reachedBare} served, {n((s) => s.bare.outcome === "not found")} not found. Nothing
                tells it the source is hostile, so it keeps answering.
              </p>
            </section>
            <section className="panel panel-pad tint-ok" aria-label="Protected">
              <div className="faint" style={{ fontSize: 12 }}>
                Behind Shield (protect mode)
              </div>
              <h2 className="c-ok" style={{ margin: "4px 0" }}>
                Refused {refused} of {steps.length}
              </h2>
              <p className="muted" style={{ margin: 0 }}>
                {reachedProt} let through
                {job.report?.summary.firstStop !== undefined
                  ? `; first refusal at step ${job.report.summary.firstStop + 1}.`
                  : steps.length
                    ? "."
                    : ""}
              </p>
            </section>
          </div>

          {job.status === "failed" && <p className="c-danger">Replay failed: {job.error}</p>}

          <div className="panel scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Request</th>
                  <th>Phase</th>
                  <th>Bare</th>
                  <th>Protected</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((s) => (
                  <Row key={s.i} s={s} />
                ))}
              </tbody>
            </table>
            {steps.length === 0 && <div className="empty">Starting a fresh sandbox pair…</div>}
          </div>

          {job.report && (
            <ul className="faint" style={{ fontSize: 13, marginTop: 16, paddingLeft: 18 }}>
              {job.report.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

export default function ReplayPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <Replay />
    </Suspense>
  );
}
