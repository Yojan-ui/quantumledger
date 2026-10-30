"use client";

/**
 * Step 1 · Detect (Atlas views/detect.js): vulnerable findings, files scanned and live connections probed;
 * the static findings with file:line evidence, and the live TLS probes. From results.detect.
 */
import { useState } from "react";
import { AtlasErrorPanel, Chip, KeyStats, NotYetRun, Part, Skeleton, Table } from "../AtlasUI";
import { fmt, useResults } from "../useResults";

const PAGE = 60;

type Probe = {
  service?: string;
  endpoint?: string;
  live?: {
    handshake_ok?: boolean;
    group?: string;
    kex_quantum_vulnerable?: boolean;
    cert_algorithm?: string;
  } | null;
  drift?: unknown[];
};

export function DetectStep() {
  const { results, error, loading, reload } = useResults();
  const [all, setAll] = useState(false);
  if (error) return <AtlasErrorPanel error={error} onRetry={reload} />;
  if (loading && results === undefined) return <Skeleton className="mt-10 h-console" />;
  if (!results)
    return <NotYetRun what="Detect" hint="Run the pipeline to scan this workspace's source." />;
  const d = results.detect;
  if (!d)
    return <NotYetRun what="Detect" hint="This workspace's results have no Detect section." />;
  const s = (d.summary ?? {}) as { vulnerable_findings?: number };
  const probes = (d.probes as unknown as Probe[]) ?? [];
  const findings = d.findings;
  const shown = all ? findings : findings.slice(0, PAGE);
  return (
    <>
      <Part title="What the scanner found" label={`run ${d.run_id.slice(0, 12)}`}>
        <KeyStats
          items={[
            {
              label: "vulnerable findings",
              value: fmt(s.vulnerable_findings),
              unit: "RSA / ECC / DH / DSA",
            },
            {
              label: "files scanned",
              value: fmt(d.files_scanned),
              unit: "code, configs, certificates",
            },
            {
              label: "live connections probed",
              value: fmt(probes.length),
              unit: "one TLS handshake each",
            },
          ]}
        />
      </Part>
      <Part disclosure title="Findings" label={`${findings.length} findings`}>
        <Table
          caption="Static findings"
          head={["File:line", "Family", "Use", "Confidence", "Rule", "Evidence"]}
          rows={shown.map((f) => [
            <span key="f" className="font-mono text-micro text-fg">
              {f.file}:{f.line}
            </span>,
            <Chip key="fa" status={f.family === "PQC" ? "hybrid" : "classical"}>
              {f.family}
            </Chip>,
            f.use,
            f.confidence,
            <span key="r" className="font-mono text-micro">
              {String(f.rule ?? "")}
            </span>,
            <code
              key="s"
              className="block max-w-text truncate font-mono text-micro text-fg-2"
              title={String(f.snippet ?? "")}
            >
              {String(f.snippet ?? "")}
            </code>,
          ])}
        />
        {findings.length > PAGE && (
          <button
            type="button"
            onClick={() => setAll((a) => !a)}
            className="mt-4 h-10 rounded-sm border border-line px-4 font-mono text-micro uppercase text-fg-2 hover:text-fg"
          >
            {all ? "Show fewer" : `Show all ${findings.length}`}
          </button>
        )}
      </Part>
      <Part disclosure title="Live connections" label={`${probes.length} probed`}>
        {probes.length === 0 ? (
          <p className="text-body text-fg-2">No live probe in this run.</p>
        ) : (
          <Table
            caption="Live TLS probes"
            head={["Service", "Endpoint", "Key exchange", "Certificate", "Drift alerts"]}
            rows={probes.map((p) => [
              p.service ?? "–",
              <span key="e" className="font-mono text-micro">
                {p.endpoint ?? "–"}
              </span>,
              p.live?.handshake_ok ? (
                <Chip key="k" status={p.live.kex_quantum_vulnerable ? "HNDL-exposed" : "hybrid"}>
                  {p.live.group ?? "–"}
                </Chip>
              ) : (
                <Chip key="k" status="failed">
                  no handshake
                </Chip>
              ),
              p.live?.cert_algorithm ?? "–",
              fmt((p.drift ?? []).length),
            ])}
          />
        )}
      </Part>
    </>
  );
}
