"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Drives Step / Play / Reset for a demo. `run(i)` performs step i and may be async; Play keeps
 * stepping until the last step, waiting `gapMs` between steps.
 */
export function useStepper(count: number, run: (i: number) => void | Promise<void>, gapMs = 900) {
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const runRef = useRef(run);
  runRef.current = run;
  const indexRef = useRef(index);
  indexRef.current = index;
  const playRef = useRef(false);

  const step = useCallback(async () => {
    const next = indexRef.current + 1;
    if (next >= count) return false;
    setBusy(true);
    try {
      await runRef.current(next);
      indexRef.current = next;
      setIndex(next);
    } finally {
      setBusy(false);
    }
    return next < count - 1;
  }, [count]);

  const play = useCallback(async () => {
    if (playRef.current) {
      playRef.current = false;
      setPlaying(false);
      return;
    }
    playRef.current = true;
    setPlaying(true);
    while (playRef.current && (await step())) await new Promise((r) => setTimeout(r, gapMs));
    playRef.current = false;
    setPlaying(false);
  }, [step, gapMs]);

  const reset = useCallback(() => {
    playRef.current = false;
    setPlaying(false);
    indexRef.current = -1;
    setIndex(-1);
  }, []);

  useEffect(() => () => void (playRef.current = false), []);

  return { index, playing, busy, done: index >= count - 1, step, play, reset };
}
