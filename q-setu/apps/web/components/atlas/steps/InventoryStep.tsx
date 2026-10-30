"use client";

/** Inventory & drift: the systems Detect turned into migration work, and static-vs-live drift per probe. */
import { AtlasErrorPanel, Chip, Honesty, NotYetRun, Part, Skeleton, Table } from "../AtlasUI";
import { fmt, useResults } from "../useResults";

type Drift = { kind?: string; severity?: string; detail?: string };
type Probe = { service?: string; endpoint?: string; drift?: Drift[] };

export function InventoryStep() {
  const { results, error, loading, reload } = useResults();
  if (error) return <AtlasErrorPanel error={error} onRetry={reload} />;
  if (loading && results === undefined) return <Skeleton className="mt-10 h-console" />;
  if (!results) return <NotYetRun what="Inventory & drift" />;
  const assets = results.assets as unknown as Record<string, unknown>[];
  const probes = (results.detect?.probes as unknown as Probe[] | undefined) ?? [];
  const drift = probes.flatMap((p) =>
    (p.drift ?? []).map((d) => ({ ...d, service: p.service, endpoint: p.endpoint })),
  );
  return (
    <>
      <Part title="Systems to migrate" label={`${assets.length} systems`}>
        {assets.length === 0 ? (
          <p className="text-body text-fg-2">Nothing to migrate: no RSA / ECC / DH found.</p>
        ) : (
          <Table
            caption="Systems to migrate"
            head={[
              "System",
              "Crypto",
              "Data class",
              "Risk weight",
              "Effort (days)",
              "Week",
              "Status",
            ]}
            rows={assets.map((a) => [
              <span key="n" className="text-fg">
                {String(a.name ?? a.id)}
              </span>,
              <span key="c" className="font-mono text-micro">
                {String(a.algorithm ?? "–")}
              </span>,
              String(a.data_class ?? "–"),
              fmt(a.risk_weight, 1),
              fmt(a.effort_days, 1),
              fmt(a.planned_week),
              <Chip key="s" status={String(a.status ?? "pending")} />,
            ])}
          />
        )}
        <div className="mt-4">
          <Honesty kind="assumption">
            Risk weight, effort and shelf life come from config/assumptions.json, not from
            measurement.
          </Honesty>
        </div>
      </Part>
      <Part
        title="Drift: live handshake vs configuration"
        label={`${fmt(results.detect?.drift_count)} alerts`}
      >
        {drift.length === 0 ? (
          <p className="text-body text-fg-2">
            No drift recorded: every probed endpoint matched its configuration.
          </p>
        ) : (
          <Table
            caption="Static versus live drift"
            head={["Service", "Endpoint", "Kind", "Severity", "Detail"]}
            rows={drift.map((d) => [
              String(d.service ?? "–"),
              <span key="e" className="font-mono text-micro">
                {String(d.endpoint ?? "–")}
              </span>,
              String(d.kind ?? "–").replaceAll("_", " "),
              <Chip key="v" status={d.severity === "high" ? "FAIL" : "partially_verified"}>
                {String(d.severity ?? "–")}
              </Chip>,
              String(d.detail ?? ""),
            ])}
          />
        )}
      </Part>
    </>
  );
}
