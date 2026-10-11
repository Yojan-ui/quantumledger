/**
 * The world's shared state. Pages write to it (scroll progress, route mode, demo node states, seal
 * events); the persistent 3D scene reads it every frame. React UI that must re-render (cursor,
 * tooltips) subscribes to the few fields it needs.
 */
import type { SectorId } from "@qsetu/sim";

export type WorldMode = "story" | "deploy" | "page" | "backdrop";

export interface Pose {
  lat: number;
  lon: number;
  dist: number;
  spin: number;
}
export type NodeState = "vulnerable" | "deploying" | "protected";

export interface Pulse {
  arc: number;
  color: "saffron" | "cyan";
  size?: number;
  /** Arc lengths per second. Live packets derive it from the measured latency. */
  speed?: number;
  /** Travel from the arc's `b` end to its `a` end. */
  reverse?: boolean;
  /** A rejected (tampered) packet: it snaps halfway and its arc flashes. */
  doomed?: boolean;
  /** Ripple this city when the packet arrives. */
  arriveAt?: string;
}

export interface Hover {
  id: string;
  label: string;
}

type Listener = () => void;

export const world = {
  mode: "story" as WorldMode,
  /** Story progress: 0..8, one unit per chapter. */
  chapter: 0,
  /** Where the globe should sit, as a fraction of the viewport (from the DOM element marked data-world-focus). */
  focus: { cx: 0.5, cy: 0.5, size: 1 },
  /** Visitor's ML-KEM-768 public key, generated in the browser by the preloader. */
  key: null as Uint8Array | null,
  /** Demo 2: node states and the active sector. */
  nodeStates: {} as Record<string, NodeState>,
  sector: "fintech" as SectorId,
  /** Event queues the scene drains each frame. */
  pulses: [] as Pulse[],
  textSeal: null as { text: string; at: number } | null,
  fragments: [] as string[],
  harvested: 0,
  /** Low-quality mode (fewer particles, lower DPR), set by PerformanceMonitor or small screens. */
  low: false,
  hover: null as Hover | null,
  /** The visible [data-world-focus] rectangle (CSS px), or null: the world only draws inside it. */
  focusRect: null as { left: number; top: number; width: number; height: number } | null,
  /** The one accent the current chapter may show ("accent" = protected, "warn" = vulnerable). */
  accent: "warn" as "accent" | "warn",
  /** Highlighted adapter socket on the globe (0..4), or -1. */
  socket: -1,
  showPulseKinds: { saffron: true, cyan: true },
  /** City ripples (sealed packets arriving), drained by the scene. */
  ripples: [] as { city: string; at: number }[],
  /** Screen position (CSS px) of the highlighted socket, written by the scene each frame. */
  socketScreen: null as { x: number; y: number } | null,
  /** Seconds-scale breathing for the atmosphere; false under reduced motion. */
  breathe: true,
  /** Camera pose for content pages (Platform = wide orbit, each solution = its city). */
  pagePose: null as Pose | null,
  /** The home-page scan result: where the scanned server is and whether it negotiated hybrid PQ. */
  scan: null as { lat: number; lon: number; ok: boolean; at: number } | null,
  /** True while the scan section is the one on screen. */
  scanActive: false,
};

const listeners = new Set<Listener>();
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function notify(): void {
  listeners.forEach((fn) => fn());
}

export function setHover(h: Hover | null): void {
  if (world.hover?.id === h?.id) return;
  world.hover = h;
  notify();
}

import { useSyncExternalStore } from "react";

/** Re-render when `select(world)` changes (call notify() after mutating). */
export function useWorld<T>(select: (w: typeof world) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(world),
    () => select(world),
  );
}
