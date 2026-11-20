"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ActionChip, Score, Synthetic } from "../lib/ui";
import { ago, api, dur, post, usePoll, type ChainReport, type Overview } from "../lib/api";

export default function Incidents() {
  const router = useRouter();
  const { data, error, reload } = usePoll<Overview>("/api/overview", 2000);
  const [chain, setChain] = useState<ChainReport | "checking">();
  const [busy, setBusy] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  // Highlight incidents that appear while the page is open.
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.incidents.map((i) => i.id));
    if (seen.current) setFresh(new Set([...ids].filter((id) => !seen.current!.has(id))));
    seen.current = ids;
  }, [data]);

  const simulate = async () => {
    setBusy(true);
    try {
      await post("/api/simulate", {});
      await reload();
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    setChain("checking");
    setChain(await api<ChainReport>("/api/verify"));
  };

  return (
    <>
      <div className="spread">
        <div>
          <h1>Incidents</h1>
          <p className="lede" style={{ margin: 0 }}>
            Requests Shield flagged on the protected sandbox, grouped by source and session. Every
            record is signed with ML-DSA-65 and chained to the one before it.
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={verify} disabled={chain === "checking"}>
            {chain === "checking" ? "Checking…" : "Verify all evidence"}
          </button>
          <button className="btn primary" onClick={simulate} disabled={busy || data?.simulating}>
            {data?.simulating ? "Sending test traffic…" : "Send test traffic"}
          </button>
        </div>
      </div>

      {chain && chain !== "checking" && (
        <p className={`panel panel-pad ${chain.ok ? "tint-ok" : "tint-danger"}`} role="status">
          <span className={chain.ok ? "c-ok" : "c-danger"}>
            {chain.ok ? "✓ Evidence intact." : "✕ Evidence has been changed."}
          </span>{" "}
          <span className="muted">
            {chain.ok
              ? `All ${chain.records} records: hashes, ML-DSA-65 signatures and chain links check out.`
              : `${chain.problems.length} problem(s), first at record ${chain.problems[0]?.seq} (${chain.problems[0]?.reason}).`}
          </span>
        </p>
      )}

      {error && !data && (
        <div className="panel empty">
          The lab API isn’t answering ({error}). Start it with{" "}
          <span className="mono">pnpm --filter @qsetu/attack-lab-ui dev</span>.
        </div>
      )}

      {data && (
        <>
          <div className="stats">
            <div className="stat">
              <b>{data.totals.incidents}</b>
              <span>incidents</span>
            </div>
            <div className="stat">
              <b>{data.totals.flagged}</b>
              <span>flagged requests</span>
            </div>
            <div className="stat">
              <b>{data.totals.patterns}</b>
              <span>patterns</span>
            </div>
            <div className="stat">
              <b className="c-sig">{data.totals.records}</b>
              <span>signed records</span>
            </div>
          </div>

          <div className="panel scroll-x">
            {data.incidents.length === 0 ? (
              <div className="empty">
                Nothing recorded yet. Send test traffic, or point anything at the protected sandbox
                at <span className="mono">{data.sandbox.protected}</span> (try{" "}
                <span className="mono">curl {data.sandbox.protected}/.env</span>).
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Incident</th>
                    <th>Pattern</th>
                    <th>Steps</th>
                    <th>Peak risk</th>
                    <th>Shield</th>
                    <th>Clients</th>
                    <th>Last seen</th>
                    <th>Signed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.incidents.map((i) => {
                    const refused =
                      (i.actions.block ?? 0) + (i.actions.challenge ?? 0) + (i.actions.limit ?? 0);
                    return (
                      <tr
                        key={i.id}
                        className={`link ${fresh.has(i.id) ? "new" : ""}`}
                        onClick={() => router.push(`/incidents/${i.id}`)}
                      >
                        <td>
                          <a className="mono" href={`/incidents/${i.id}`}>
                            {i.id}
                          </a>
                        </td>
                        <td>
                          <span className="row" style={{ gap: 8 }}>
                            {i.pattern.name} <Synthetic on={i.synthetic} />
                          </span>
                        </td>
                        <td className="mono">
                          {i.steps} <span className="faint">· {dur(i.durationMs)}</span>
                        </td>
                        <td>
                          <Score n={i.maxScore} />
                        </td>
                        <td>
                          {refused ? (
                            <span className="c-ok">refused {refused}</span>
                          ) : (
                            <ActionChip action="allow" />
                          )}
                        </td>
                        <td className="muted">{i.clients.join(", ")}</td>
                        <td className="muted">{ago(i.lastSeen)}</td>
                        <td>
                          <span className={i.sealed ? "c-sig" : "c-3"}>
                            {i.sealed ? "sealed" : "sealing…"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <p className="faint" style={{ fontSize: 13, marginTop: 12 }}>
            Updates every 2 s. IPs are kept only as keyed hashes; no bodies, query strings or
            headers beyond the client family are stored.
          </p>
        </>
      )}
    </>
  );
}
