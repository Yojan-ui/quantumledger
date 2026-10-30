"use client";

/**
 * /diagnostics?ws=<workspace>: the HUD driving a Q-Shield (Atlas) workspace instead of a domain. The stages
 * are Atlas's own (GET /atlas-api/stages); "Run" starts POST /workspaces/<ws>/runs and every stage moves
 * only on a real SSE event (see lib/client/atlas-run). The terminal shows the run's live log; a failed step
 * shows as failed with its message. Keys: ← → stages, Space run, R reset, ? shortcuts; presenter mode
 * (→ ← R, play) drives the same actions. No new 3D canvas: the domain HUD's stage stays its own.
 */
import Link from "next/link";
import { useEffect } from "react";
import { usePresent } from "@/lib/client/present";
import { atlasRun, getAtlasRun, useAtlasRun, type StageStatus } from "@/lib/client/atlas-run";
import { useAtlasMe } from "@/lib/client/useAtlas";
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
    <ol className="grid grid-cols-4 md:grid-cols-8" aria-label="Q-Shield pipeline stages">
      {s.stages.map((st, i) => {
        const status = s.status[i] ?? "idle";
        return (
          <li
            key={st.id}
            data-stage={st.id}
            data-status={status}
            className="relative border-r border-t border-line last:border-r-0"
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
  const viewStatus = s.view >= 0 ? (s.status[s.view] ?? "idle") : "idle";
  const canRun = me.canOperate && ws !== "demo";

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
    play: () => canRun && void atlasRun.start(),
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") atlasRun.view(getAtlasRun().view + 1);
      else if (e.key === "ArrowLeft") atlasRun.view(getAtlasRun().view - 1);
      else if (e.key === " ") {
        e.preventDefault();
        if (canRun) void atlasRun.start();
      } else if (e.key === "r" || e.key === "R") atlasRun.reset();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [canRun]);

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
        <HudPanel label="Stage" className="min-h-panel">
          <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
            {view ? (
              <>
                <p className={`font-mono text-micro uppercase ${TONE[viewStatus]}`}>
                  {MARK[viewStatus]} {String(s.view + 1).padStart(2, "0")} · {viewStatus}
                </p>
                <h2 className="text-h2 font-medium text-fg">{view.label}</h2>
                <p className="max-w-text text-body text-fg-2">{view.plain}</p>
                <p className="font-mono text-micro text-fg-3">steps: {view.steps.join(" → ")}</p>
              </>
            ) : (
              <>
                <h2 className="text-h2 font-medium text-fg">
                  {s.stages.length
                    ? `${s.stages.length} stages, run by Atlas`
                    : "Loading the stages…"}
                </h2>
                <p className="max-w-text text-body text-fg-2">
                  {canRun
                    ? "Press Run (or Space). Each stage lights up only when Atlas reports it, from the live run log."
                    : ws === "demo"
                      ? "The demo workspace is a read-only snapshot: open its results, or pick a workspace you can run."
                      : me.user
                        ? "Viewers can watch runs; an operator starts them."
                        : "Sign in as an operator to start a run."}
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
        <Terminal className="min-h-panel" atlas={{ lines: s.lines, step: stepOfView }} />
      </div>
      <div className="border border-line bg-glass" role="group" aria-label="Pipeline">
        <Stepper />
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2">
          <button
            type="button"
            onClick={() => void atlasRun.start()}
            disabled={!canRun || s.running || !s.stages.length}
            className="h-8 rounded-sm border border-line-strong px-3 font-mono text-micro uppercase text-fg disabled:opacity-40"
          >
            {s.running ? "Running…" : "Run pipeline · Space"}
          </button>
          <button
            type="button"
            onClick={() => atlasRun.reset()}
            disabled={s.running}
            className="h-8 rounded-sm border border-line px-3 font-mono text-micro uppercase text-fg-2 hover:text-fg disabled:opacity-40"
          >
            Reset · R
          </button>
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
