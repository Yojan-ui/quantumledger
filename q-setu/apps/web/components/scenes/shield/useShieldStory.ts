"use client";

/**
 * Drives "Shield plugs in": a real run (POST /api/shield/plugin, streamed NDJSON) or a recorded one,
 * and the story time `t` (in beats) that the scene, the caption, the counters and the console all
 * read through `view(events, t)` (./model), so they can't disagree.
 *
 *  - live: `run(mode)` starts a real run; `t` advances beat by beat as the events allow, holding each
 *    beat long enough to play its motion and then be read (HOLD, ≥ 1.2 s after the motion). If the
 *    live run can't start here (a serverless host), it plays the recorded run and says so.
 *  - scroll: `progress` (0–1) scrubs a recorded run.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RECORDED from "@/data/shield-runs.json";
import {
  available,
  BEATS,
  summariseAttack,
  view,
  type AttackSummary,
  type InstallMode,
  type PluginEvent,
} from "./model";

/** Seconds each beat holds in live play: its motion (≤ 2 s) plus at least 1.2 s to read it. */
export const HOLD = [4.0, 3.8, 3.8, 3.4, 4.2, 4.0, 3.8];

const recorded = RECORDED as unknown as {
  recordedAt: string;
  runs: Record<InstallMode, PluginEvent[]>;
};
export const RECORDED_DATE = new Date(recorded.recordedAt).toLocaleDateString("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

async function* streamRun(mode: InstallMode, signal: AbortSignal): AsyncGenerator<PluginEvent> {
  const r = await fetch("/api/shield/plugin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode }),
    signal,
  });
  if (!r.ok || !r.body) throw new Error(`The live run didn't start (${r.status}).`);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) yield JSON.parse(line) as PluginEvent;
    }
  }
}

export function useShieldStory({
  drive,
  progress = 0,
  reduce,
}: {
  drive: "live" | "scroll";
  progress?: number;
  reduce: boolean;
}) {
  const [mode, setMode] = useState<InstallMode>("dns");
  const [events, setEvents] = useState<PluginEvent[]>(drive === "scroll" ? recorded.runs.dns : []);
  const [source, setSource] = useState<"recorded" | "live">("recorded");
  const [attack, setAttack] = useState<AttackSummary>();
  const [busy, setBusy] = useState<"run" | "attack" | null>(null);
  const [note, setNote] = useState<string>();
  const [t, setT] = useState(0);
  const tRef = useRef(0);
  const playing = useRef(false);
  const abort = useRef<AbortController>(undefined);

  // Scroll: the scroll position is the story time (the attack only once one has run).
  useEffect(() => {
    if (drive !== "scroll") return;
    const last = attack ? BEATS.length : BEATS.length - 1;
    const next = Math.min(last - 0.001, progress * last);
    tRef.current = reduce ? Math.floor(next) + 0.999 : next;
    setT(tRef.current);
  }, [drive, progress, attack, reduce]);

  // Live: advance through the beats as the events allow, holding each long enough to see.
  useEffect(() => {
    if (drive !== "live") return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!playing.current) return;
      const cap = available(events, attack) - 0.001;
      const b = Math.floor(tRef.current);
      // Reduced motion: each beat is a still frame, held, then the next.
      const nextT = Math.min(cap, tRef.current + dt / (HOLD[b] ?? 3.5));
      const shown = reduce ? Math.min(cap, Math.floor(nextT) + 0.999) : nextT;
      tRef.current = nextT;
      setT(shown);
      if (nextT >= cap && events.some((e) => e.t === "done") && (attack || b >= 5))
        playing.current = false;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [drive, events, attack, reduce]);

  const run = useCallback(async (m: InstallMode) => {
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setMode(m);
    setAttack(undefined);
    setNote(undefined);
    setEvents([]);
    tRef.current = 0;
    setT(0);
    playing.current = true;
    setBusy("run");
    const got: PluginEvent[] = [];
    try {
      for await (const e of streamRun(m, ac.signal)) {
        if (e.t === "error") throw new Error(e.message);
        got.push(e);
        setEvents([...got]);
      }
      setSource("live");
    } catch (e) {
      if (ac.signal.aborted) return;
      setEvents(recorded.runs[m]);
      setSource("recorded");
      setNote(`${(e as Error).message} Playing the recorded run from ${RECORDED_DATE}.`);
    } finally {
      if (abort.current === ac) setBusy(null);
    }
  }, []);

  const runAttack = useCallback(async () => {
    setBusy("attack");
    setNote(undefined);
    try {
      const r = await fetch("/api/shield/plugin/attack", { method: "POST" });
      if (!r.ok) throw new Error(`The attack run didn't start (${r.status}).`);
      const { results } = (await r.json()) as { results: Parameters<typeof summariseAttack>[0] };
      setAttack(summariseAttack(results));
      playing.current = true;
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, []);

  /** Steps the story by whole beats (pauses live play). */
  const step = useCallback(
    (d: number) => {
      playing.current = false;
      const cap = available(events, attack);
      tRef.current = Math.max(0, Math.min(cap - 0.001, Math.floor(tRef.current) + d + 0.999));
      setT(tRef.current);
    },
    [events, attack],
  );

  /** Scroll mode switches between the recorded runs. */
  const choose = useCallback(
    (m: InstallMode) => {
      if (drive === "live") return void run(m);
      setMode(m);
      setEvents(recorded.runs[m]);
    },
    [drive, run],
  );

  const stop = useCallback(() => {
    abort.current?.abort();
    playing.current = false;
  }, []);
  useEffect(() => () => abort.current?.abort(), []);

  const v = useMemo(() => view(events, t, mode, attack), [events, t, mode, attack]);
  /** Seconds into the current beat (the scene's motion clock; a pure function of t). */
  const beatSeconds = (t - Math.floor(t)) * (HOLD[Math.floor(t)] ?? 3.5);
  return {
    v,
    t,
    beatSeconds,
    mode,
    events,
    source,
    attack,
    busy,
    note,
    started: events.length > 0,
    run,
    runAttack,
    step,
    choose,
    stop,
  };
}

export type ShieldStory = ReturnType<typeof useShieldStory>;
