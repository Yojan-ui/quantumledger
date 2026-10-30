"use client";

/**
 * Handshake gates: the recorded TLS 1.3 lab handshakes (metadata only, no decryption) and every gate's
 * verdict: PQ handshake, PQ authentication, downgrade refused, compatibility matrix, tested rollback,
 * then the per-wave status. Classical sessions keep Atlas's "HNDL-exposed" label.
 */
import { AtlasErrorPanel, Chip, Honesty, NotYetRun, Part, Skeleton, Table } from "../AtlasUI";
import { fmt, useResults } from "../useResults";

type Session = {
  service_id?: string;
  negotiated_group?: string;
  kex_class?: string;
  hndl_exposed?: boolean;
  label?: string;
  cipher?: string;
  cert_alg?: string;
};
type Gate = {
  gate?: string;
  service_id?: string;
  result?: string;
  reason?: string;
  label?: string;
};
type Gates = {
  pq_handshake?: Gate[];
  pq_auth?: Gate[];
  downgrade?: Gate[];
  compat_matrix?: Gate[];
  forced_rollback?: Record<string, unknown>;
  wave_counts?: Record<string, number>;
};
type Wave = { week: number; assets: string[]; status: string };

export function HandshakesStep() {
  const { results, error, loading, reload } = useResults();
  if (error) return <AtlasErrorPanel error={error} onRetry={reload} />;
  if (loading && results === undefined) return <Skeleton className="mt-10 h-console" />;
  if (!results) return <NotYetRun what="Handshake gates" />;
  const he = results.handshake_evidence as unknown as {
    sessions?: Session[];
    note?: string;
    openssl_version?: string;
  } | null;
  const g = results.gates as unknown as Gates | null;
  const waves = results.waves as unknown as Wave[];
  const gateRows = [
    ...(g?.pq_handshake ?? []),
    ...(g?.pq_auth ?? []),
    ...(g?.downgrade ?? []),
    ...(g?.compat_matrix ?? []),
  ];
  const rb = g?.forced_rollback;
  return (
    <>
      <Part title="Recorded handshakes" label={he?.openssl_version ?? undefined}>
        {he?.sessions?.length ? (
          <Table
            caption="TLS 1.3 handshakes with the lab services"
            head={["Service", "Negotiated group", "Key exchange", "Label"]}
            rows={he.sessions.map((s) => [
              s.service_id ?? "–",
              <span key="g" className="font-mono text-micro">
                {s.negotiated_group ?? "–"}
              </span>,
              <Chip key="k" status={s.kex_class === "classical" ? "classical" : "hybrid"}>
                {s.kex_class ?? "–"}
              </Chip>,
              <span key="l" className={s.hndl_exposed ? "text-danger" : "text-fg-2"}>
                {s.label ?? ""}
              </span>,
            ])}
          />
        ) : (
          <p className="text-body text-fg-2">No handshakes recorded for this workspace.</p>
        )}
        {he?.note && <p className="mt-3 text-small text-fg-3">{he.note}</p>}
      </Part>
      <Part title="Gates" label={`${gateRows.length} checks`}>
        {gateRows.length ? (
          <Table
            caption="Gate results"
            head={["Gate", "Service", "Result", "Reason"]}
            rows={gateRows.map((x) => [
              String(x.gate ?? "–").replaceAll("_", " "),
              x.service_id ?? "–",
              <Chip key="r" status={x.result ?? "–"} />,
              <span key="w" className="text-small">
                {x.reason ?? x.label ?? ""}
              </span>,
            ])}
          />
        ) : (
          <p className="text-body text-fg-2">Gates: not yet run.</p>
        )}
        {rb && (
          <p className="mt-4 text-small text-fg-2">
            Tested rollback: {String(rb.service_id)} from {String(rb.from_mode)} to{" "}
            {String(rb.to_mode)}: <Chip status={String(rb.status ?? "–")} />{" "}
            {rb.restored_config_sha256 && rb.restored_config_sha256 === rb.snapshot_sha256
              ? "config restored (SHA-256 matches the snapshot)"
              : "restored config differs from the snapshot"}
          </p>
        )}
      </Part>
      <Part
        title="Waves"
        label={
          g?.wave_counts
            ? Object.entries(g.wave_counts)
                .map(([k, v]) => `${v} ${k.replaceAll("_", " ")}`)
                .join(" · ")
            : undefined
        }
      >
        <Table
          caption="Status per wave"
          head={["Week", "Systems", "Status"]}
          rows={waves.map((w) => [
            fmt(w.week),
            w.assets.join(", "),
            <Chip key="s" status={w.status} />,
          ])}
        />
        <div className="mt-4">
          <Honesty kind="simulation">
            Waves are verified on local lab stand-ins only. Nothing is reported as applied without
            gate evidence; systems with no lab stand-in stay not verified in lab.
          </Honesty>
        </div>
      </Part>
    </>
  );
}
