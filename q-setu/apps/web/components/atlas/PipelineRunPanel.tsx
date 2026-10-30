"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { atlas, type AtlasResults } from "@/lib/client/atlas";
import { atlasRun, getAtlasRun, useAtlasRun } from "@/lib/client/atlas-run";
import { buildFlowModel, recordedStatuses } from "@/lib/client/atlas-flowviz";
import { useAtlas, useAtlasMe } from "@/lib/client/useAtlas";
import { PipelineFlowView } from "@/components/hud/PipelineFlowView";
import { Button } from "@/components/ui";
import { Details } from "./AtlasUI";

export function PipelineRunPanel({ ws, results }: { ws: string; results?: AtlasResults | null }) {
  const me = useAtlasMe();
  const run = useSearchParams().get("run");
  const s = useAtlasRun((x) => x);
  useEffect(() => {
    if (me.loading) return;
    let active = true;
    void atlasRun.init(ws, !!me.user).then(() => {
      if (active && run && me.user && getAtlasRun().runId !== run) atlasRun.follow(ws, run);
    });
    return () => {
      active = false;
      atlasRun.dispose();
    };
  }, [ws, run, me.loading, me.user?.username]); // eslint-disable-line react-hooks/exhaustive-deps
  const own = s.ws === ws;
  const live = own && s.running;
  const done = own ? s.stages.filter((_, i) => s.status[i] === "done").map((x) => x.id) : [];
  const progress = useAtlas(
    live && me.user ? `live:${ws}:${s.runId}:${done.join(",")}` : null,
    (signal) => atlas.progress(ws, { signal }),
  );
  const p = progress.data;
  const current = live
    ? p?.schedule && done.includes("schedule")
      ? ({
          assets: p.schedule.assets.map((a) => ({
            ...a,
            status: done.includes("gates")
              ? (p.wave_status?.asset_status?.[a.id] ?? a.status)
              : "planned",
          })),
          waves: done.includes("gates")
            ? (p.wave_status?.waves ?? p.schedule.waves)
            : p.schedule.waves,
          tiebreak: done.includes("tiebreak") ? p.tiebreak : null,
        } as unknown as AtlasResults)
      : null
    : results;
  const model = buildFlowModel(
    current,
    own ? s.stages : [],
    live || (own && s.result === "FAIL") ? s.status : recordedStatuses(results, s.stages),
  );
  const caption = live
    ? `Live run · ${s.runId}`
    : own && s.result
      ? `Run ${s.result} · ${s.runId}`
      : ws === "demo"
        ? "Fictional bank · recorded scan and real TLS lab evidence"
        : "Recorded workspace results · planned migration";
  return (
    <div className="space-y-4 py-6">
      <PipelineFlowView model={model} caption={caption} />
      <ol
        aria-label="Live execution steps"
        className="grid grid-cols-3 gap-2 md:grid-cols-3 lg:grid-cols-9"
      >
        {model.stations.map((st) => (
          <li
            key={st.id}
            data-stage={st.id}
            data-status={st.status}
            className="min-w-0 rounded-sm border border-line p-2 text-small text-fg-2"
          >
            <span className="block text-fg">{st.label}</span>
            <span className="text-micro">{st.status === "done" ? "recorded" : st.status}</span>
          </li>
        ))}
      </ol>
      {me.canOperate && ws !== "demo" && (
        <Button disabled={live || !s.stages.length} onClick={() => void atlasRun.start()}>
          {live ? "Running…" : "Run pipeline"}
        </Button>
      )}
      {own && s.error && (
        <p role="alert" className="text-small text-danger">
          {s.error}
        </p>
      )}
      {progress.error && (
        <p role="alert" className="text-small text-danger">
          Live progress unavailable: {progress.error.message}
        </p>
      )}
      {own && s.lines.length > 0 && (
        <Details summary="Live run log">
          <pre
            role="log"
            className="max-h-console overflow-auto whitespace-pre-wrap break-words font-mono text-micro"
          >
            {s.lines.map((l) => `[${l.step}] ${l.text}`).join("\n")}
          </pre>
        </Details>
      )}
    </div>
  );
}
