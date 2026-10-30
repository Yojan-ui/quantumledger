"use client";

/**
 * Step 4 · Handshake gates (Atlas views/handshakes.js): lab connections on post-quantum, waves that passed
 * every gate, the tested rollback; then the gates per wave, the recorded TLS 1.3 sessions (metadata only, no
 * decryption), the compatibility modes by client and the live endpoints. Classical sessions keep Atlas's
 * "HNDL-exposed" label. Counts use Atlas's own rowsOf().
 */
import { rowsOf } from "@/lib/client/atlas-flow";
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
import { fmt, useResults } from "../useResults";

type Gate = { result?: string; reason?: string; negotiated_group?: string };
type LabService = {
  lab_service: string;
  status?: string;
  from_mode?: string;
  to_mode?: string;
  assets?: string[];
  gates?: { pq_handshake?: Gate };
};
type Wave = {
  week: number;
  assets: string[];
  status: string;
  evidence?: { lab_services?: LabService[] };
};
type Cell = {
  client: string;
  result?: string;
  actual?: { negotiated_group?: string; error?: string };
};
type Compat = { mode: string; service_id?: string; cells?: Cell[] };
type Rollback = {
  service_id?: string;
  from_mode?: string;
  to_mode?: string;
  status?: string;
  snapshot_sha256?: string;
  restored_config_sha256?: string;
  health_check?: { client?: string; result?: string; negotiated_group?: string };
};

const HNDL = "HNDL-exposed: recorded traffic relies on classical key exchange";

export function HandshakesStep() {
  const { results, error, loading, reload } = useResults();
  if (error) return <AtlasErrorPanel error={error} onRetry={reload} />;
  if (loading && results === undefined) return <Skeleton className="mt-10 h-console" />;
  if (!results || !results.handshake_evidence) return <NotYetRun what="Handshake gates" />;
  const he = results.handshake_evidence as unknown as { openssl_version?: string; note?: string };
  const g = (results.gates ?? {}) as unknown as {
    compat_matrix?: Compat[];
    forced_rollback?: Rollback;
  };
  const waves = results.waves as unknown as Wave[];
  const rows = rowsOf(results);
  const labRows = rows.filter((x) => !x.live);
  const hybrid = labRows.filter((x) => !x.classical).length;
  const passed = waves.filter((w) => w.status === "applied").length;
  const fr = g.forced_rollback;
  const rollbackOk =
    !!fr && !!fr.restored_config_sha256 && fr.restored_config_sha256 === fr.snapshot_sha256;
  const perWave = waves.flatMap((w) => (w.evidence?.lab_services ?? []).map((e) => ({ w, e })));
  const clients = [
    ...new Set((g.compat_matrix ?? []).flatMap((c) => (c.cells ?? []).map((x) => x.client))),
  ];
  return (
    <>
      <Part title="Handshake gates at a glance" label={he.openssl_version}>
        <KeyStats
          items={[
            {
              label: "lab connections on post-quantum",
              value: fmt(hybrid),
              unit: `of ${labRows.length} lab services`,
            },
            {
              label: "waves passed every gate",
              value: fmt(passed),
              unit: `of ${waves.length} waves`,
            },
            {
              label: "rollback tested",
              value: fmt(rollbackOk ? 1 : 0),
              unit: fr ? (fr.status ?? "–") : "not run",
            },
          ]}
        />
      </Part>
      <Part title="Gates per wave">
        <Table
          caption="Status per wave"
          head={["Week", "Systems", "Status"]}
          rows={waves.map((w) => [
            fmt(w.week),
            w.assets.join(", "),
            <Chip key="s" status={w.status} />,
          ])}
        />
        <div className="mt-6">
          <Table
            caption="Lab services per wave"
            head={["Week", "Lab service", "Mode", "Status", "PQ handshake"]}
            rows={perWave.map(({ w, e }) => [
              fmt(w.week),
              e.lab_service,
              <span key="m" className="font-mono text-micro">
                {e.from_mode} → {e.to_mode}
              </span>,
              <Chip key="s" status={e.status ?? "not_verified_in_lab"} />,
              <Chip key="p" status={e.gates?.pq_handshake?.result ?? "not_requested"}>
                {e.gates?.pq_handshake?.result ?? "not run"}
                {e.gates?.pq_handshake?.negotiated_group
                  ? ` · ${e.gates.pq_handshake.negotiated_group}`
                  : ""}
              </Chip>,
            ])}
          />
        </div>
        <div className="mt-4">
          <Honesty kind="simulation">
            Waves are verified on lab stand-ins on 127.0.0.1 only; systems with no lab service stay
            “not verified in lab”.
          </Honesty>
        </div>
      </Part>
      <Part title="Lab services" label={`${labRows.length} TLS 1.3 sessions`}>
        <Table
          caption="TLS 1.3 handshake sessions"
          head={["Service", "Key exchange", "PQ gate", "Downgrade", "Server auth"]}
          rows={labRows.map((x) => [
            x.s.service_id,
            <Chip key="k" status={x.classical ? "HNDL-exposed" : "hybrid"}>
              {x.s.negotiated_group ?? "–"}
            </Chip>,
            <Chip key="g" status={String(x.kex?.result ?? "not_requested")}>
              {String(x.kex?.result ?? "not run")}
            </Chip>,
            <Chip key="d" status={String(x.down?.result ?? "not_requested")}>
              {String(x.down?.result ?? "not run")}
            </Chip>,
            <span key="a" className="text-small">
              {String(x.auth?.auth_alg ?? x.s.auth_alg ?? "–")}
            </span>,
          ])}
        />
        {labRows.some((x) => x.classical) && <p className="mt-3 text-small text-danger">{HNDL}</p>}
        {he.note && <p className="mt-2 text-small text-fg-3">{he.note}</p>}
      </Part>
      <Part title="Compatibility" label="modes by client">
        {clients.length ? (
          <Table
            caption="Modes by client"
            head={["Mode", ...clients]}
            rows={(g.compat_matrix ?? []).map((c) => [
              c.mode,
              ...clients.map((cl) => {
                const x = (c.cells ?? []).find((y) => y.client === cl);
                return x ? (
                  <Chip key={cl} status={x.result ?? "–"}>
                    {x.result} · {x.actual?.negotiated_group ?? x.actual?.error ?? ""}
                  </Chip>
                ) : (
                  "not tested"
                );
              }),
            ])}
          />
        ) : (
          <p className="text-body text-fg-2">Compatibility matrix: not yet run.</p>
        )}
      </Part>
      <Part title="Tested rollback">
        {fr ? (
          <Table
            caption="Tested rollback"
            head={["Service", "Outcome", "Restored config", "Health check"]}
            rows={[
              [
                <span key="s" className="font-mono text-micro">
                  {fr.service_id}: {fr.from_mode} → {fr.to_mode}
                </span>,
                <Chip key="o" status={fr.status ?? "–"} />,
                rollbackOk ? "equals the snapshot (SHA-256)" : "differs from the snapshot",
                fr.health_check
                  ? `${fr.health_check.client}: ${fr.health_check.result} (${fr.health_check.negotiated_group ?? "no handshake"})`
                  : "–",
              ],
            ]}
          />
        ) : (
          <p className="text-body text-fg-2">Rollback: not yet run.</p>
        )}
      </Part>
      <Part title="Live endpoints">
        {rows.some((x) => x.live) ? (
          <Table
            caption="Live TLS probes"
            head={["Service", "Endpoint", "Key exchange", "Certificate"]}
            rows={rows
              .filter((x) => x.live)
              .map((x) => [
                x.s.service_id,
                <span key="e" className="font-mono text-micro">
                  {x.s.endpoint}
                </span>,
                <Chip key="k" status={x.classical ? "HNDL-exposed" : "hybrid"}>
                  {x.s.negotiated_group ?? "–"}
                </Chip>,
                x.s.auth_alg ?? "–",
              ])}
          />
        ) : (
          <p className="text-body text-fg-2">No live probe in this run.</p>
        )}
      </Part>
    </>
  );
}
