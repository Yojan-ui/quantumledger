"use client";

import { atlas } from "@/lib/client/atlas";
import { useAtlas } from "@/lib/client/useAtlas";
import { buildFlowModel, recordedStatuses } from "@/lib/client/atlas-flowviz";
import { PipelineFlowView } from "@/components/hud/PipelineFlowView";
import { AtlasErrorPanel, Skeleton } from "./AtlasUI";

export function PipelinePreview({ ws }: { ws: string }) {
  const data = useAtlas(`preview:${ws}`, (signal) => atlas.results(ws, { signal }));
  const stages = useAtlas("pipeline-stages", (signal) => atlas.stages({ signal }));
  if (data.error || stages.error)
    return (
      <AtlasErrorPanel
        error={(data.error ?? stages.error)!}
        onRetry={() => {
          data.reload();
          stages.reload();
        }}
      />
    );
  if (!data.data || !stages.data) return <Skeleton className="h-stage-sm" />;
  const results = data.data.results;
  return (
    <PipelineFlowView
      model={buildFlowModel(
        results,
        stages.data.stages,
        recordedStatuses(results, stages.data.stages),
      )}
      caption={
        ws === "demo"
          ? "Bank demo · fictional systems, recorded scan and TLS lab results"
          : "Recorded workspace results · planned migration"
      }
    />
  );
}
