"use client";

/**
 * Optional sound, off by default (remembered in localStorage). Every sound is synthesised with the
 * Web Audio API (no files), shorter than 300 ms, peaks below −18 dBFS and never loops.
 */
import { useSyncExternalStore } from "react";

const KEY = "ql:sfx";
/** −18 dBFS as linear gain; every sound peaks at or below this. */
const PEAK = 10 ** (-18 / 20);
let ctx: AudioContext | undefined;
const listeners = new Set<() => void>();

const read = () => typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "on";

export function setSfx(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* private mode */
  }
  if (on) ctx ??= new AudioContext();
  listeners.forEach((fn) => fn());
}

export const useSfx = () =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    read,
    () => false,
  );

/** One enveloped voice: attack 5 ms, exponential release, total ≤ `ms` (≤ 300). */
function voice(
  ms: number,
  build: (a: AudioContext, out: GainNode, t: number, end: number) => void,
  level = 1,
) {
  if (!read() || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  ctx ??= new AudioContext();
  const a = ctx;
  if (a.state === "suspended") void a.resume();
  const t = a.currentTime;
  const end = t + Math.min(300, ms) / 1000;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(PEAK * Math.min(1, level), t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  g.connect(a.destination);
  build(a, g, t, end);
}

function osc(
  a: AudioContext,
  out: AudioNode,
  type: OscillatorType,
  f0: number,
  f1: number,
  t: number,
  end: number,
) {
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, end);
  o.connect(out);
  o.start(t);
  o.stop(end);
}

export const sfx = {
  /** A soft tick for each terminal line. */
  tick: () => voice(30, (a, g, t, e) => osc(a, g, "square", 2400, 1800, t, e), 0.25),
  /** A low hum when harvesting starts. */
  hum: () => voice(280, (a, g, t, e) => osc(a, g, "sine", 70, 62, t, e), 0.9),
  /** A glassy break when the link shatters. */
  shatter: () =>
    voice(
      260,
      (a, g, t, e) => {
        const n = Math.floor(a.sampleRate * 0.26);
        const buf = a.createBuffer(1, n, a.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
        const src = a.createBufferSource();
        src.buffer = buf;
        const hp = a.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 3200;
        src.connect(hp).connect(g);
        src.start(t);
        src.stop(e);
        osc(a, g, "triangle", 4200, 2600, t, e);
      },
      0.7,
    ),
  /** A click when the block locks. */
  lock: () => voice(80, (a, g, t, e) => osc(a, g, "square", 900, 300, t, e), 0.5),
  /** The radar's sweep tone. */
  sweep: () => voice(300, (a, g, t, e) => osc(a, g, "sine", 440, 880, t, e), 0.6),
};
