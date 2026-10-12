"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/client/motion";
import type { DirectorState, Shot } from "./types";

/** Minimum time a shot is held in autoplay, so its label can be read. */
export const MIN_HOLD_MS = 1500;

/**
 * Drives an ordered list of shots. The camera itself is animated inside the scene (DirectorCamera),
 * which reports back through `onSettled`. Autoplay never advances on a timer alone: a demo calls
 * `cue(shotId)` when the real crypto behind the next shot has finished, and the director moves there
 * once the current shot has been held for at least MIN_HOLD_MS.
 */
export function useDirector(shots: Shot[]) {
  const [index, setIndex] = useState(0);
  const [settled, setSettled] = useState(false);
  const [take, setTake] = useState(0);
  const [reduce, setReduce] = useState(false);
  const settledAt = useRef(0);
  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const indexRef = useRef(0);

  useEffect(() => setReduce(prefersReducedMotion()), []);

  const go = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(shots.length - 1, i));
      if (next === indexRef.current) return;
      shots[indexRef.current]?.exit?.();
      indexRef.current = next;
      setSettled(false);
      setIndex(next);
      shots[next]?.enter?.();
    },
    [shots],
  );

  const onSettled = useCallback(() => {
    settledAt.current = performance.now();
    setSettled(true);
    // A cue that arrived while the camera was moving plays after the minimum hold.
    if (pending.current !== null) {
      const target = pending.current;
      pending.current = null;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => go(target), MIN_HOLD_MS);
    }
  }, [go]);

  /** Move to a shot once its real crypto has finished (respecting the minimum hold). */
  const cue = useCallback(
    (id: string) => {
      const i = shots.findIndex((s) => s.id === id);
      if (i < 0 || i === indexRef.current) return;
      if (!settledAt.current || indexRef.current === -1) return go(i);
      const held = performance.now() - settledAt.current;
      if (!settledRef.current) {
        pending.current = i;
        return;
      }
      clearTimeout(timer.current);
      timer.current = setTimeout(() => go(i), Math.max(0, MIN_HOLD_MS - held));
    },
    [shots, go],
  );
  const settledRef = useRef(false);
  settledRef.current = settled;

  const replay = useCallback(() => {
    clearTimeout(timer.current);
    pending.current = null;
    indexRef.current = 0;
    setSettled(false);
    setIndex(0);
    setTake((t) => t + 1);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const state: DirectorState = useMemo(
    () => ({ index, shot: shots[index]!, settled, reduce, take }),
    [index, shots, settled, reduce, take],
  );
  return {
    state,
    shots,
    go,
    cue,
    next: () => go(indexRef.current + 1),
    prev: () => go(indexRef.current - 1),
    replay,
    onSettled,
  };
}

export type Director = ReturnType<typeof useDirector>;
