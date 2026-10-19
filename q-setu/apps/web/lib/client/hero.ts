"use client";

/**
 * The homepage opening, as one shared timeline the DOM and the 3D both read:
 *   keygen  a real ML-KEM-768 key pair is generated in a worker (its time is shown)
 *   logo    the swarm's particles hold the QuantumLedger lattice-cube mark
 *   burst   the mark explodes outward into the swarm (same particles, no cut)
 *   loop    the attract loop: the real pipeline on the cached example, compressed to ~9 s
 *   idle    the scene drifts; the "Enter any website" input takes over
 */
import { useSyncExternalStore } from "react";

export type HeroPhase = "keygen" | "logo" | "burst" | "loop" | "idle";

export const hero = {
  phase: "keygen" as HeroPhase,
  keygenMs: 0,
  /** performance.now() when the mark began assembling / bursting (0 = not yet). */
  assembleAt: 0,
  burstAt: 0,
  /** How far the hero has scrolled away (0 = in place, 1 = gone): the camera pulls back out. */
  exit: 0,
};
const listeners = new Set<() => void>();

export function setHero(p: Partial<typeof hero>) {
  Object.assign(hero, p);
  listeners.forEach((fn) => fn());
}

export function useHero<T>(select: (h: typeof hero) => T): T {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    () => select(hero),
    () => select({ phase: "keygen", keygenMs: 0, assembleAt: 0, burstAt: 0, exit: 0 }),
  );
}

/** Assembly (dust → mark) and burst (mark → swarm) lengths. */
export const ASSEMBLE_MS = 1100;
export const BURST_MS = 1400;

/**
 * What the particle shader reads each frame. `assemble`: 0 = scattered dust, 1 = on the mark.
 * `intro`: 1 = the mark (or dust) owns the particles, 0 = the swarm does. Outside the opening both
 * are such that the swarm behaves exactly as on /diagnostics.
 */
export function heroIntro(now: number): { assemble: number; intro: number } {
  switch (hero.phase) {
    case "keygen":
      return { assemble: 0, intro: 1 };
    case "logo":
      return {
        assemble: hero.assembleAt ? Math.min(1, (now - hero.assembleAt) / ASSEMBLE_MS) : 0,
        intro: 1,
      };
    case "burst":
      return { assemble: 1, intro: Math.max(0, 1 - (now - hero.burstAt) / BURST_MS) };
    default:
      return { assemble: 1, intro: 0 };
  }
}
