"use client";

/**
 * Overview (Atlas's /w/<ws>/pipeline): three headline numbers and the seven steps, each with the same fact
 * the original Atlas Overview shows (lib/client/atlas-flow flowFacts). No fact = "not yet run".
 */
import Link from "next/link";
import { PipelinePreview } from "../PipelinePreview";
import { atlas } from "@/lib/client/atlas";
import { FLOW, flowFacts } from "@/lib/client/atlas-flow";
import { useAtlas, useAtlasMe } from "@/lib/client/useAtlas";
import { AtlasErrorPanel, KeyStats, NotYetRun, Part, Skeleton } from "../AtlasUI";
import { fmt, useResults } from "../useResults";

export function OverviewStep() {
  const { ws, results, error, loading, reload } = useResults();
  const me = useAtlasMe();
  const reviews = useAtlas(me.user ? `reviews:${ws}:${me.user.username}` : null, (signal) =>
    atlas.reviews(ws, { signal }),
  );
  if (error) return <AtlasErrorPanel error={error} onRetry={reload} />;
  if (loading && results === undefined) return <Skeleton className="mt-10 h-console" />;
  if (!results) return <NotYetRun what="Overview" hint="Run the pipeline from the Pipeline HUD." />;
  const facts = flowFacts(results, reviews.data);
  const v = results.ledger_verification as { ok?: boolean } | null;
  return (
    <>
      <div className="py-6">
        <PipelinePreview ws={ws} />
      </div>
      <Part title="At a glance">
        <KeyStats
          items={[
            {
              label: "systems to migrate",
              value: fmt(results.assets.length),
              unit: "use RSA / ECC today",
            },
            {
              label: "weeks to migrate",
              value: results.exposure
                ? fmt((results.exposure as { makespan_weeks?: number }).makespan_weeks)
                : "–",
              unit: "optimised plan",
            },
            {
              label: "proof records",
              value: results.ledger
                ? fmt((results.ledger as { entry_count?: number }).entry_count)
                : "–",
              unit: v?.ok ? "signed and verified" : "signed",
            },
          ]}
        />
      </Part>
      <Part title="Follow the pipeline">
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {FLOW.map((s, i) => {
            const f = facts[s.id];
            return (
              <li key={s.id} className="h-full">
                <Link
                  prefetch={false}
                  href={`/atlas/${encodeURIComponent(ws)}/${s.href}`}
                  className="flex h-full flex-col gap-2 rounded-lg border border-line p-4 hover:border-line-strong"
                >
                  <span className="font-mono text-micro uppercase text-fg-3">
                    {i + 1} · {s.label}
                  </span>
                  <span className="tabular text-h3 font-medium text-fg">
                    {f ? f.num : "not yet run"}
                  </span>
                  <span className="text-small text-fg-2">{f ? f.mean : s.hands}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </Part>
    </>
  );
}
