"use client";

/** Step 1 · Detect: RSA / ECC / DH findings with file:line evidence, from results.detect. */
import { useState } from "react";
import { MiniStat } from "@/components/ui/Stat";
import { AtlasErrorPanel, Chip, NotYetRun, Part, Skeleton, Table } from "../AtlasUI";
import { fmt, useResults } from "../useResults";

const PAGE = 60;

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
  const s = (d.summary ?? {}) as {
    vulnerable_findings?: number;
    pqc_findings?: number;
    files_with_findings?: number;
    by_family?: Record<string, number>;
  };
  const findings = d.findings;
  const shown = all ? findings : findings.slice(0, PAGE);
  return (
    <>
      <Part title="What the scanner found" label={`run ${d.run_id.slice(0, 12)}`}>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <MiniStat value={fmt(d.files_scanned)} label="files scanned" />
          <MiniStat value={fmt(s.vulnerable_findings)} label="quantum-breakable findings" />
          <MiniStat value={fmt(s.pqc_findings)} label="post-quantum findings" />
          <MiniStat value={fmt(s.files_with_findings)} label="files with findings" />
        </div>
        {s.by_family && (
          <p className="mt-6 font-mono text-micro uppercase text-fg-3">
            {Object.entries(s.by_family)
              .map(([k, v]) => `${k} ${v}`)
              .join(" · ")}
          </p>
        )}
      </Part>
      <Part title="Findings with file:line evidence" label={`${findings.length} findings`}>
        <Table
          caption="Findings with file and line"
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
    </>
  );
}
