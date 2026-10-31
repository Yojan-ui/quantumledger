"use client";

/**
 * /diagnostics?ws=<workspace>: the HUD driving a Q-Shield (Atlas) workspace instead of a domain. The stages
 * are Atlas's own (GET /atlas-api/stages); "Run" starts POST /workspaces/<ws>/runs and every stage moves
 * only on a real SSE event (see lib/client/atlas-run). The terminal shows the run's live log; a failed step
 * shows as failed with its message. Keys: ← → stages, Space run, R reset, ? shortcuts; presenter mode
 * (→ ← R, play) drives the same actions. No new 3D canvas: the domain HUD's stage stays its own.
 */
import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePresent } from "@/lib/client/present";
import {
  RECORDED,
  atlasRun,
  getAtlasRun,
  useAtlasRun,
  type StageStatus,
} from "@/lib/client/atlas-run";
import { atlas, type AtlasResults } from "@/lib/client/atlas";
import { buildFlowModel } from "@/lib/client/atlas-flowviz";
import { useAtlas, useAtlasMe } from "@/lib/client/useAtlas";
import { PipelineFlowView } from "./PipelineFlowView";
import { HudPanel } from "./HudPanel";
import { Terminal } from "./Terminal";

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

const TONE: Record<StageStatus, string> = {
  idle: "text-fg-3",
  running: "text-warn",
  done: "text-ok",
  failed: "text-danger",
};
const MARK: Record<StageStatus, string> = { idle: "·", running: "…", done: "✓", failed: "✗" };

function Stepper() {
  const s = useAtlasRun((x) => x);
  return (
    <ol className="grid grid-cols-3 md:flex" aria-label="Q-Shield pipeline stages">
      {s.stages.map((st, i) => {
        const status = s.status[i] ?? "idle";
        return (
          <li
            key={st.id}
            data-stage={st.id}
            data-status={status}
            className="relative min-w-0 border-r border-t border-line last:border-r-0 md:flex-1"
          >
            <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-line">
              <span
                className={`block h-full origin-left transition-transform duration-300 ${status === "failed" ? "bg-danger" : "bg-ok"}`}
                style={{
                  transform: `scaleX(${status === "done" || status === "failed" ? 1 : status === "running" ? 0.5 : 0})`,
                }}
              />
            </span>
            <button
              type="button"
              onClick={() => atlasRun.view(i)}
              aria-current={s.view === i ? "step" : undefined}
              className={`block w-full px-2 py-2 text-left font-mono text-micro uppercase md:px-3 ${s.view === i ? "bg-raised text-fg" : TONE[status]}`}
            >
              {MARK[status]} {String(i + 1).padStart(2, "0")}{" "}
              <span className="hidden md:inline">{st.label}</span>
              <span className="md:hidden">{st.label.slice(0, 4)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function AtlasHud({ ws }: { ws: string }) {
  const s = useAtlasRun((x) => x);
  const me = useAtlasMe();
  const view = s.view >= 0 ? s.stages[s.view] : undefined;
  // results.json for the view (public for the demo); refetched when a run ends
  const res = useAtlas(`hud-results:${ws}:${s.result ?? ""}:${s.runId ?? ""}`, (signal) =>
    atlas.results(ws, { signal }),
  );
  const ranOrReplaying = s.running || !!s.replay || s.status.some((x) => x !== "idle");
  // Without a run on screen the view shows the recorded results: every stage present, or up to the stage
  // picked with ← → (stepping through real data, never a timer).
  const shown = ranOrReplaying
    ? s.status
    : s.stages.map((_, i) =>
        res.data?.results ? (s.view < 0 || i <= s.view ? "done" : "idle") : "idle",
      );
  // During a live run or a replay, results.json does not exist yet (or is the previous run's): the batches
  // come from the plan files the run writes (GET /progress), each used only once its own step has finished
  // in the run on screen; refetched on every step_end.
  // the recorded demo run (results.json) replays from the results already on screen; anything else is live
  const recorded = s.replay === RECORDED;
  const live = !recorded && (s.running || !!s.replay);
  const doneIds = s.stages.filter((_, i) => s.status[i] === "done").map((x) => x.id);
  const prog = useAtlas(
    live && me.user ? `progress:${ws}:${s.runId}:${doneIds.join(",")}` : null,
    (signal) => atlas.progress(ws, { signal }),
  );
  const led = useAtlas(
    live && me.user && doneIds.includes("seal") ? `led:${ws}:${s.runId}` : null,
    (signal) => atlas.ledger(ws, { signal }),
  );
  const p = prog.data;
  const ws_ = doneIds.includes("gates") ? p?.wave_status : null;
  const liveResults =
    p?.schedule && doneIds.includes("schedule")
      ? ({
          assets: p.schedule.assets.map((a) => ({
            ...a,
            status: ws_?.asset_status?.[a.id] ?? a.status,
          })),
          waves: ws_?.waves ?? p.schedule.waves,
          tiebreak: doneIds.includes("tiebreak") ? p.tiebreak : null,
          ledger: led.data?.available ? { entry_count: led.data.entry_count } : null,
          ledger_verification:
            led.data?.available && led.data.live_verification
              ? { ok: led.data.live_verification.ok }
              : null,
        } as unknown as AtlasResults)
      : null;
  const model = buildFlowModel(live ? liveResults : res.data?.results, s.stages, shown);
  const caption = recorded
    ? "recorded run (results.json), replayed"
    : s.replay
      ? `replay of recorded run ${s.replay} (gaps over 2 s shortened)`
      : s.running
        ? `live run ${s.runId ?? ""}`
        : ranOrReplaying
          ? `last run ${s.result ?? ""}`
          : res.data?.results
            ? `recorded results (results.json)${s.view >= 0 ? ` up to ${s.stages[s.view]?.label}` : ""}; ← → to step`
            : "not yet run";
  const viewStatus = s.view >= 0 ? (s.status[s.view] ?? "idle") : "idle";
  const canRun = me.canOperate && ws !== "demo";
  const results = res.data?.results;
  /**
   * Space / Run: an operator runs a writable workspace live (SSE). On the read-only demo an operator replays
   * Atlas's own log of the last run; signed out (or if that fails) the recorded run plays from results.json.
   */
  const run = () => {
    const st = getAtlasRun();
    if (st.running || st.replay) return;
    if (canRun) return void atlasRun.start();
    if (me.canOperate)
      return void atlasRun.replayLast().then(() => {
        if (getAtlasRun().error && results) {
          atlasRun.reset();
          void atlasRun.replayRecorded(results);
        }
      });
    if (results) void atlasRun.replayRecorded(results);
  };
  const runRef = useRef(run);
  runRef.current = run;

  const signedIn = !!me.user;
  useEffect(() => {
    if (me.loading && !me.data) return; // wait to know whether /runs may be asked
    void atlasRun.init(ws, signedIn);
    return () => atlasRun.dispose();
  }, [ws, signedIn, me.loading, me.data]);

  usePresent({
    next: () => atlasRun.view(getAtlasRun().view + 1),
    prev: () => atlasRun.view(getAtlasRun().view - 1),
    reset: () => atlasRun.reset(),
    play: () => runRef.current(),
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") atlasRun.view(getAtlasRun().view + 1);
      else if (e.key === "ArrowLeft") atlasRun.view(getAtlasRun().view - 1);
      else if (e.key === " ") {
        e.preventDefault();
        runRef.current();
      } else if (e.key === "r" || e.key === "R") atlasRun.reset();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const stepOfView = view
    ? ([...s.lines].reverse().find((l) => view.steps.includes(l.step))?.step ?? null)
    : null;
  return (
    <div data-present-target className="flex h-full min-h-0 flex-col gap-2">
      <header className="flex flex-wrap items-center justify-between gap-2 border border-line bg-glass px-3 py-2">
        <p className="font-mono text-micro uppercase text-fg-2">
          Q-Shield · workspace <span className="text-fg">{ws}</span>
          {s.result && (
            <span className={s.result === "PASS" ? "text-ok" : "text-danger"}>
              {" "}
              · last run {s.result}
            </span>
          )}
          {s.running && <span className="text-warn"> · running</span>}
        </p>
        <nav className="flex flex-wrap gap-2" aria-label="Diagnostics mode">
          <Link
            prefetch={false}
            href="/diagnostics"
            className="h-8 rounded-sm border border-line px-3 py-2 font-mono text-micro uppercase text-fg-2 hover:text-fg"
          >
            Domain mode
          </Link>
          <Link
            prefetch={false}
            href={`/atlas/${encodeURIComponent(ws)}/detect`}
            className="h-8 rounded-sm border border-line px-3 py-2 font-mono text-micro uppercase text-fg-2 hover:text-fg"
          >
            Results pages
          </Link>
        </nav>
      </header>
      <div className="grid min-h-0 flex-1 gap-2 md:grid-cols-split">
        <HudPanel label="Stage" className="min-h-panel" glass={false}>
          <div className="flex h-full flex-col gap-2 overflow-hidden p-3">
            <PipelineFlowView
              model={model}
              caption={caption}
              stationRow={false}
              tall
              follow={s.running || !!s.replay}
            />
            {view ? (
              <>
                <p className={`font-mono text-micro uppercase ${TONE[viewStatus]}`}>
                  {MARK[viewStatus]} {String(s.view + 1).padStart(2, "0")} · {viewStatus}
                </p>
                <h2 className="text-h3 font-medium text-fg">{view.label}</h2>
                <p className="max-w-text text-small text-fg-2">{view.plain}</p>
                <p className="font-mono text-micro text-fg-3">steps: {view.steps.join(" → ")}</p>
              </>
            ) : (
              <>
                <h2 className="text-h3 font-medium text-fg">
                  {s.stages.length
                    ? `${s.stages.length} stages, run by Atlas`
                    : "Loading the stages…"}
                </h2>
                <p className="max-w-text text-body text-fg-2">
                  {canRun
                    ? "Press Run (or Space). Each stage lights up only when Atlas reports it, from the live run log."
                    : "Press Space (or Run) to replay the recorded run, stage by stage."}
                </p>
              </>
            )}
            {s.error && (
              <p role="alert" className="border-t border-line pt-3 text-small text-danger">
                {s.error}
              </p>
            )}
          </div>
        </HudPanel>
        <Terminal
          className="min-h-panel"
          atlas={{
            lines: s.lines,
            step: stepOfView,
            label: recorded ? "recorded run" : s.running ? "live · SSE" : "run log",
            intro: [
              `workspace ${ws}${ws === "demo" ? " (read-only snapshot)" : ""}`,
              `stages: ${s.stages.map((x, i) => `${i + 1} ${x.label}`).join(" · ") || "loading…"}`,
              canRun
                ? "press Space to run live (SSE)"
                : results
                  ? "press Space to replay the recorded run"
                  : "no recorded results yet",
            ],
          }}
        />
      </div>
      <div className="border border-line bg-glass" role="group" aria-label="Pipeline">
        <Stepper />
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2">
          <button
            type="button"
            onClick={run}
            disabled={s.running || !!s.replay || !s.stages.length || (!canRun && !results)}
            className="h-8 rounded-sm border border-line-strong px-3 font-mono text-micro uppercase text-fg disabled:opacity-40"
          >
            {recorded ? "Replaying…" : s.running ? "Running…" : "Run pipeline · Space"}
          </button>
          <button
            type="button"
            onClick={() => atlasRun.reset()}
            disabled={s.running}
            className="h-8 rounded-sm border border-line px-3 font-mono text-micro uppercase text-fg-2 hover:text-fg disabled:opacity-40"
          >
            Reset · R
          </button>
          {me.user && (
            <button
              type="button"
              onClick={() => void atlasRun.replayLast()}
              disabled={s.running || !!s.replay}
              className="h-8 rounded-sm border border-line px-3 font-mono text-micro uppercase text-fg-2 hover:text-fg disabled:opacity-40"
            >
              {s.replay ? "Replaying…" : "Replay recorded run"}
            </button>
          )}
          {!me.user && (
            <Link
              prefetch={false}
              href={`/atlas/signin?next=${encodeURIComponent(`/atlas/${ws}/detect`)}`}
              className="ml-auto font-mono text-micro uppercase text-fg-3 hover:text-fg"
            >
              Sign in to run
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
