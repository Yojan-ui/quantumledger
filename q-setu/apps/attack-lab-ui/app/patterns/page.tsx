"use client";
import Link from "next/link";
import { ago, usePoll, type Pattern } from "../../lib/api";

export default function Patterns() {
  const { data, error } = usePoll<{ patterns: Pattern[] }>("/api/patterns", 5000);
  const max = Math.max(1, ...(data?.patterns.map((p) => p.count) ?? []));
  return (
    <>
      <h1>Patterns</h1>
      <p className="lede">
        Incidents that look alike, grouped by simple named rules (each names the evidence it keys
        on). Anything that fits none of them lands in “Other automated abuse” and deserves a
        person’s look.
      </p>
      {error && !data && <div className="panel empty">Couldn’t load patterns: {error}</div>}
      {data && data.patterns.length === 0 && <div className="panel empty">No incidents yet.</div>}
      <div className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
        {data?.patterns.map((p) => (
          <section key={p.id} className="panel panel-pad" aria-label={p.name}>
            <div className="spread" style={{ marginBottom: 12, alignItems: "baseline" }}>
              <div>
                <h2 style={{ marginBottom: 4 }}>{p.name}</h2>
                <p className="muted" style={{ margin: 0 }}>
                  {p.description}
                </p>
              </div>
              <div className="row" style={{ gap: 24 }}>
                <span>
                  <b style={{ fontSize: 24, fontWeight: 500 }}>{p.count}</b>{" "}
                  <span className="faint">incident{p.count === 1 ? "" : "s"}</span>
                </span>
                <span className="muted">last seen {ago(p.lastSeen)}</span>
              </div>
            </div>
            <div className="bar c-danger" style={{ width: "100%", marginBottom: 16 }}>
              <span style={{ width: `${(p.count / max) * 100}%` }} />
            </div>
            <div className="grid2">
              <div>
                <div className="faint" style={{ fontSize: 12, marginBottom: 6 }}>
                  Most requested
                </div>
                <div className="mono">
                  {p.topRoutes.map((r) => (
                    <div key={r.route} className="row" style={{ justifyContent: "space-between" }}>
                      <span style={{ overflowWrap: "anywhere" }}>{r.route}</span>
                      <span className="faint">{r.n}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="faint" style={{ fontSize: 12, marginBottom: 6 }}>
                  Clients · {p.clients.join(", ")}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {p.incidentIds.slice(0, 12).map((id) => (
                    <Link key={id} href={`/incidents/${id}`} className="chip mono">
                      {id}
                    </Link>
                  ))}
                  {p.incidentIds.length > 12 && (
                    <span className="faint">+{p.incidentIds.length - 12}</span>
                  )}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
