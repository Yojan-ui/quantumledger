"use client";

import { useCallback, useRef, useState } from "react";
import { MIN_HOLD_MS, type Director } from "./useDirector";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Turns a director into a film a demo can play. Moving to a shot runs the real work that shot shows
 * (`need(i)`) while the camera flies there, and resolves once both are done. Play holds each shot for
 * at least MIN_HOLD_MS after it settles, then advances, so autoplay never outruns the crypto.
 * A "detour" (e.g. Attack it) cuts to a shot outside the sequence, runs its work, holds, and returns.
 */
export function useFilm(
  director: Director,
  {
    last,
    need,
    hold,
    onArrive,
    restart,
  }: {
    /** Index of the final shot that Next and Play reach (detour shots sit after it). */
    last: number;
    /** Perform the real work shot `i` shows (crypto, deploys, API calls). */
    need: (i: number) => void | Promise<void>;
    /** Hold for a shot (ms) in autoplay; at least MIN_HOLD_MS. */
    hold?: (id: string) => number | undefined;
    /** Called when the camera arrives at a shot (to stage things that should happen in view). */
    onArrive?: (id: string) => void;
    /** Put the demo back to its start before playing again from the top. */
    restart: () => void;
  },
) {
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const playRef = useRef(false);
  const busyRef = useRef(false);
  const shot = useRef(0);
  shot.current = director.state.index;
  const returnTo = useRef(0);
  const queued = useRef(false);
  const arrivals = useRef<(() => void)[]>([]);
  const cfg = useRef({ need, hold, onArrive, restart });
  cfg.current = { need, hold, onArrive, restart };

  const onSettled = useCallback(() => {
    director.onSettled();
    cfg.current.onArrive?.(director.shots[shot.current]!.id);
    arrivals.current.splice(0).forEach((r) => r());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [director.onSettled]);

  const stop = useCallback(() => {
    playRef.current = false;
    setPlaying(false);
  }, []);

  /** Run `fn` exclusively (one shot change at a time); ignored while another is running. */
  async function exclusive(fn: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      busyRef.current = false;
      setBusy(false);
      // A Next pressed while the camera was moving plays now, instead of being dropped.
      if (queued.current) {
        queued.current = false;
        setTimeout(() => void next(), 0);
      }
    }
  }

  /** Fly to shot `i` while its real work runs; resolves when both are done. */
  async function advance(i: number) {
    const moving = i !== shot.current;
    const arrive = moving ? new Promise<void>((r) => arrivals.current.push(r)) : null;
    if (moving) director.go(i);
    await Promise.all([cfg.current.need(i), arrive]);
  }

  function next() {
    stop();
    if (busyRef.current) {
      queued.current = true;
      return Promise.resolve();
    }
    return exclusive(async () => {
      const to = shot.current > last ? returnTo.current : Math.min(last, shot.current + 1);
      if (to !== shot.current) await advance(to);
    });
  }

  const prev = () => {
    if (busyRef.current) return;
    stop();
    director.go(shot.current > last ? returnTo.current : shot.current - 1);
  };

  /** Jump to shot `i` (e.g. a demo's own button), running whatever it needs. */
  const to = (i: number) => {
    stop();
    return exclusive(() => advance(i));
  };

  async function play() {
    if (playRef.current) return stop();
    if (busyRef.current) return;
    if (shot.current >= last) {
      cfg.current.restart();
      await wait(400);
    }
    playRef.current = true;
    setPlaying(true);
    while (playRef.current && shot.current < last) {
      const id = director.shots[shot.current]!.id;
      await wait(Math.max(MIN_HOLD_MS, cfg.current.hold?.(id) ?? 0));
      if (!playRef.current) break;
      await exclusive(() => advance(shot.current + 1));
    }
    stop();
  }

  /** Cut to a shot outside the sequence, run `fn` there, hold, then return to where we were. */
  const detour = (i: number, fn: () => Promise<void>, holdMs = 2200) => {
    stop();
    return exclusive(async () => {
      if (shot.current <= last) returnTo.current = shot.current;
      const arrive = new Promise<void>((r) => arrivals.current.push(r));
      director.go(i);
      await arrive;
      await fn();
      await wait(holdMs);
      director.go(returnTo.current);
    });
  };

  return { playing, busy, onSettled, next, prev, play, stop, to, detour };
}

export type FilmControls = ReturnType<typeof useFilm>;
