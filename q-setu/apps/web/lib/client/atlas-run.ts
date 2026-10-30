"use client";

/**
 * The Q-Shield pipeline as the diagnostics HUD sees it: Atlas's stages (GET /atlas-api/stages) and one run's
 * live state. A stage's status changes only on a real SSE event from Atlas (step_start / step_end /
 * run_end), never on a timer. A failed step marks its stage failed with the step's last log line.
 */
import { useSyncExternalStore } from "react";
import { AtlasError, atlas, type RunEvent, type Stage } from "./atlas";

export type StageStatus = "idle" | "running" | "done" | "failed";
export type LogLine = { seq: number; step: string; text: string };
export type AtlasRunState = {
  ws: string;
  stages: Stage[];
  status: StageStatus[];
  view: number;
  runId: string | null;
  running: boolean;
  result: "PASS" | "FAIL" | null;
  lines: LogLine[];
  error: string | null;
};

const MAX_LINES = 400;
let state: AtlasRunState = {
  ws: "",
  stages: [],
  status: [],
  view: -1,
  runId: null,
  running: false,
  result: null,
  lines: [],
  error: null,
};
const subs = new Set<() => void>();
let close: (() => void) | null = null;

function set(p: Partial<AtlasRunState>) {
  state = { ...state, ...p };
  subs.forEach((f) => f());
}
export const getAtlasRun = () => state;
export function useAtlasRun<T>(pick: (s: AtlasRunState) => T): T {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => pick(state),
    () => pick(state),
  );
}

const stageOf = (step: string) => state.stages.findIndex((s) => s.steps.includes(step));
const msg = (e: unknown) =>
  e instanceof AtlasError ? e.message : "Couldn't reach the Q-Shield backend";

function onEvent(ev: RunEvent) {
  const status = [...state.status];
  if (ev.type === "run_start") {
    set({
      status: state.stages.map(() => "idle"),
      lines: [],
      result: null,
      error: null,
      running: true,
    });
    return;
  }
  if (ev.type === "line") {
    const lines = [
      ...state.lines,
      { seq: ev.seq, step: String(ev.step), text: String(ev.text ?? "") },
    ];
    set({ lines: lines.length > MAX_LINES ? lines.slice(-MAX_LINES) : lines });
    return;
  }
  const i = typeof ev.step === "string" ? stageOf(ev.step) : -1;
  if (ev.type === "step_start" && i >= 0) {
    status[i] = "running";
    set({ status, view: i });
  } else if (ev.type === "step_end" && i >= 0) {
    const ok = ev.exit_code === 0;
    const steps = state.stages[i]!.steps;
    const last = steps[steps.length - 1] === ev.step;
    if (!ok) {
      const tail = [...state.lines].reverse().find((l) => l.step === ev.step)?.text;
      status[i] = "failed";
      set({
        status,
        error: `${state.stages[i]!.label} failed (step ${String(ev.step)}, exit ${String(ev.exit_code)})${tail ? `: ${tail}` : ""}`,
      });
    } else {
      if (last) status[i] = "done";
      set({ status });
    }
  } else if (ev.type === "run_end") {
    const result = ev.status === "PASS" ? "PASS" : "FAIL";
    const tail = Array.isArray(ev.tail)
      ? (ev.tail as unknown[]).map(String).filter(Boolean).slice(-1)[0]
      : undefined;
    set({
      running: false,
      result,
      error: result === "FAIL" ? (state.error ?? `Run failed${tail ? `: ${tail}` : ""}`) : null,
    });
    close?.();
    close = null;
  }
}

function follow(ws: string, runId: string) {
  close?.();
  set({ runId, running: true });
  close = atlas.runEvents(ws, runId, onEvent, () => {
    // EventSource retries by itself; only say so if the run is still open.
    if (state.running) set({ error: "Lost the live log; reconnecting…" });
  });
}

export const atlasRun = {
  /** Loads the stages and, if a run is in progress in this workspace, follows it. */
  async init(ws: string) {
    if (state.ws !== ws) {
      close?.();
      close = null;
      set({ ws, runId: null, running: false, result: null, lines: [], error: null, view: -1 });
    }
    try {
      const { stages } = state.stages.length ? { stages: state.stages } : await atlas.stages();
      set({
        stages,
        status: state.status.length === stages.length ? state.status : stages.map(() => "idle"),
      });
      const runs = await atlas.runs(ws).catch(() => null);
      if (runs?.active) follow(ws, runs.active);
    } catch (e) {
      set({ error: msg(e) });
    }
  },
  /** POST /workspaces/<ws>/runs, then follow its events. */
  async start() {
    if (state.running || !state.ws) return;
    set({ error: null, result: null, status: state.stages.map(() => "idle"), lines: [] });
    try {
      const { run_id } = await atlas.startRun(state.ws);
      follow(state.ws, run_id);
    } catch (e) {
      set({ error: msg(e) });
    }
  },
  view(i: number) {
    if (i >= 0 && i < state.stages.length) set({ view: i });
  },
  /** Clears what is on screen (not the server's results). */
  reset() {
    if (state.running) return;
    set({ status: state.stages.map(() => "idle"), lines: [], result: null, error: null, view: -1 });
  },
  dispose() {
    close?.();
    close = null;
  },
};
