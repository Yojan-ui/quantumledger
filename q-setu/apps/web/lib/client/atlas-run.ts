"use client";

/**
 * The Q-Shield pipeline as the diagnostics HUD sees it: Atlas's stages (GET /atlas-api/stages) and one run's
 * live state. A stage's status changes only on a real SSE event from Atlas (step_start / step_end /
 * run_end), never on a timer. A failed step marks its stage failed with the step's last log line.
 */
import { useSyncExternalStore } from "react";
import { AtlasError, atlas, type AtlasResults, type RunEvent, type Stage } from "./atlas";
import { recordedRunEvents } from "./atlas-recorded";

/** `replay` value while the recorded demo run (results.json) plays, for visitors who are not signed in. */
export const RECORDED = "results.json";

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
  /** set while a recorded run's events are being replayed (not a live run) */
  replay: string | null;
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
  replay: null,
};
const subs = new Set<() => void>();
let close: (() => void) | null = null;
let generation = 0;

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
  async init(ws: string, signedIn: boolean) {
    const gen = ++generation;
    if (state.ws !== ws) {
      close?.();
      close = null;
      set({
        ws,
        status: [],
        runId: null,
        running: false,
        result: null,
        lines: [],
        error: null,
        view: -1,
      });
    }
    try {
      const { stages } = state.stages.length ? { stages: state.stages } : await atlas.stages();
      if (gen !== generation) return;
      set({
        stages,
        status: state.status.length === stages.length ? state.status : stages.map(() => "idle"),
      });
      // GET /runs needs a session: signed out there is nothing to follow (and no 401 in the console).
      const runs = signedIn ? await atlas.runs(ws).catch(() => null) : null;
      if (gen !== generation) return;
      if (runs?.active) follow(ws, runs.active);
    } catch (e) {
      set({ error: msg(e) });
    }
  },
  follow,
  /** POST /workspaces/<ws>/runs, then follow its events. */
  async start() {
    if (state.running || !state.ws) return;
    set({
      running: true,
      error: null,
      result: null,
      status: state.stages.map(() => "idle"),
      lines: [],
    });
    try {
      const { run_id } = await atlas.startRun(state.ws);
      follow(state.ws, run_id);
    } catch (e) {
      set({ running: false, error: msg(e) });
    }
  },
  /**
   * Replays the workspace's latest finished run from its event log (Atlas keeps it), paced by the recorded
   * timestamps; gaps longer than 2 s are shortened to 2 s (the HUD says "replay"). Needs a session.
   */
  async replayLast() {
    if (state.running || !state.ws) return;
    try {
      const { runs } = await atlas.runs(state.ws);
      const last = runs.find((r) => r.kind === "pipeline" && r.status !== "running" && r.finished);
      if (!last) return set({ error: "No recorded pipeline run in this workspace yet." });
      const evs: RunEvent[] = [];
      await new Promise<void>((done) => {
        const stop = atlas.runEvents(
          state.ws,
          last.id,
          (ev) => {
            evs.push(ev);
            if (ev.type === "run_end") {
              stop();
              done();
            }
          },
          () => {
            stop();
            done();
          },
        );
      });
      set({ replay: last.id, runId: last.id, error: null });
      let prev = evs[0]?.ts ?? 0;
      for (const ev of evs) {
        await new Promise((r) => setTimeout(r, Math.min(2000, Math.max(0, (ev.ts - prev) * 1000))));
        prev = ev.ts;
        if (state.replay !== last.id) return; // reset or a live run took over
        onEvent(ev);
      }
      set({ replay: null });
    } catch (e) {
      set({ error: msg(e), replay: null });
    }
  },
  /** Plays the recorded run from results.json into the terminal and the 3D view (no session needed). */
  async replayRecorded(results: AtlasResults) {
    if (state.running || state.replay || !state.stages.length) return;
    const evs = recordedRunEvents(results, state.stages);
    set({ replay: RECORDED, runId: null, error: null });
    let prev = 0;
    for (const ev of evs) {
      await new Promise((r) => setTimeout(r, Math.max(0, (ev.ts - prev) * 1000)));
      prev = ev.ts;
      if (state.replay !== RECORDED) return; // reset or a live run took over
      onEvent(ev);
    }
    set({ replay: null, running: false });
  },
  view(i: number) {
    if (i >= 0 && i < state.stages.length) set({ view: i });
  },
  /** Clears what is on screen (not the server's results). */
  reset() {
    if (state.running) return;
    set({
      replay: null,
      status: state.stages.map(() => "idle"),
      lines: [],
      result: null,
      error: null,
      view: -1,
    });
  },
  dispose() {
    generation++;
    close?.();
    close = null;
  },
};
