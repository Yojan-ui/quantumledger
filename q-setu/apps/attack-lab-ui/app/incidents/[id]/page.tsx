"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ActionChip, PHASE, PhaseChip, Score, Synthetic } from "../../../lib/ui";
import { dur, time, usePoll, type IncidentDetail } from "../../../lib/api";

export default function IncidentPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = usePoll<IncidentDetail>(`/api/incidents/${id}`, 3000);

  if (error && !data)
    return (
      <div className="panel empty">
        Couldn’t load {id}: {error}
      </div>
    );
  if (!data) return <p className="muted">Loading…</p>;
  const { incident: inc, timeline: t, check } = data;
  const span = Math.max(1, t.durationMs);

  return (
    <>
      <p className="faint" style={{ margin: "0 0 8px" }}>
        <Link href="/" className="muted">
          Incidents
        </Link>{" "}
        / <span className="mono">{inc.id}</span>
      </p>
      <div className="spread">
        <div>
          <h1 className="row" style={{ gap: 12 }}>
            {data.pattern.name} <Synthetic on={inc.synthetic} />
          </h1>
          <p className="lede" style={{ margin: 0 }}>
            {data.pattern.description} {t.steps.length} steps over {dur(t.durationMs)}
            {t.firstStop !== undefined
              ? `; Shield first refused at step ${t.firstStop + 1}.`
              : "; Shield refused nothing."}
          </p>
        </div>
        <Link className="btn primary" href={`/replay?incident=${inc.id}`}>
          Replay in sandbox
        </Link>
      </div>

      <section
        className="panel panel-pad"
        style={{ marginBottom: 16 }}
        aria-label="Timeline overview"
      >
        <div className="spread" style={{ marginBottom: 0, alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Timeline</h2>
          <div className="legend">
            {(Object.keys(PHASE) as (keyof typeof PHASE)[])
              .filter((p) => t.phases[p])
              .map((p) => (
                <span key={p} className={`row ${PHASE[p].tone}`} style={{ gap: 6 }}>
                  <span className="dot" />
                  {PHASE[p].label} <span className="faint">{t.phases[p]}</span>
                </span>
              ))}
          </div>
        </div>
        <div
          className="strip"
          role="img"
          aria-label={`${t.steps.length} steps across ${dur(t.durationMs)}`}
        >
          {t.steps.map((s) => (
            <i
              key={s.i}
              className={PHASE[s.phase].tone}
              style={{ left: `${(s.offsetMs / span) * 100}%`, opacity: s.flagged ? 1 : 0.45 }}
              title={`${s.i + 1}. ${s.method} ${s.route} · ${s.action}`}
            />
          ))}
        </div>
        <div className="row faint mono" style={{ justifyContent: "space-between", fontSize: 12 }}>
          <span>{time(inc.opened)}</span>
          <span>+{dur(t.durationMs)}</span>
        </div>
      </section>

      <div className="split">
        <section className="panel panel-pad" aria-label="Steps">
          <ol className="steps">
            {t.steps.map((s) => (
              <li key={s.i} className="step">
                <span className="mono faint">+{dur(s.offsetMs)}</span>
                <span className={`rail ${PHASE[s.phase].tone}`}>
                  <span className="dot" style={{ opacity: s.flagged ? 1 : 0.45 }} />
                </span>
                <div className="what">
                  <div className="row" style={{ gap: 8 }}>
                    <span className="mono route">
                      <span className="faint">{s.method}</span> {s.route}
                    </span>
                    <span className="mono faint">{s.status}</span>
                  </div>
                  {s.signals.length > 0 && <div className="signals">{s.signals.join(" · ")}</div>}
                </div>
                <div className="row step-tags">
                  <PhaseChip phase={s.phase} />
                  <ActionChip action={s.action} />
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 16 }}>
          <section
            className={`panel panel-pad ${check.ok ? "tint-sig" : "tint-danger"}`}
            aria-label="Evidence"
          >
            <h2 className={check.ok ? "c-sig" : "c-danger"}>
              {check.ok
                ? "✓ Signed and intact"
                : check.seal.ok
                  ? "✕ An event was changed"
                  : "Not sealed yet"}
            </h2>
            <dl className="kv mono">
              <dt>signature</dt>
              <dd>{data.key.alg}</dd>
              <dt>key</dt>
              <dd>{data.key.keyId}</dd>
              <dt>events</dt>
              <dd>
                {check.events} signed
                {check.badEvents.length ? `, ${check.badEvents.length} failing` : ""}
              </dd>
              <dt>seal</dt>
              <dd>
                {data.seal ? `record ${data.seal.seq}, covers ${data.seal.covers}` : "pending"}
                {check.unsealed > 0 && data.seal ? ` (+${check.unsealed} newer)` : ""}
              </dd>
              {data.seal && (
                <>
                  <dt>hash</dt>
                  <dd>{data.seal.hash.slice(0, 32)}…</dd>
                </>
              )}
            </dl>
          </section>
          <section className="panel panel-pad" aria-label="Source">
            <h2>Source</h2>
            <dl className="kv">
              <dt>peak risk</dt>
              <dd>
                <Score n={inc.maxScore} />
              </dd>
              <dt>IP hashes</dt>
              <dd className="mono">{inc.ipHashes.join(", ")}</dd>
              {inc.sessionHashes.length > 0 && (
                <>
                  <dt>sessions</dt>
                  <dd className="mono">{inc.sessionHashes.join(", ")}</dd>
                </>
              )}
              <dt>ASN</dt>
              <dd className="muted">{inc.asns.join(", ") || "no lookup configured"}</dd>
              <dt>clients</dt>
              <dd>{inc.clients.join(", ")}</dd>
              <dt>engine events</dt>
              <dd>{inc.types.join(", ")}</dd>
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}
