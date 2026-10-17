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
  /** Camera pitch over the surface and heading, degrees (see director.ts). */
  tilt?: number;
  yaw?: number;
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
  /** The real bus event behind the packet (shown when it's clicked in flight). */
  info?: PacketInfo;
}

/** What a packet in flight carries: the measured fields of its bus event. */
export interface PacketInfo {
  seq: number;
  op: string;
  alg: string;
  ms: number;
  bytes?: number;
  from?: string;
  to?: string;
  sim: boolean;
}

/** A label pinned by a click: a city (its live counts) or a packet in flight (its event). */
export type Pinned =
  | { kind: "city"; city: string; label: string; x: number; y: number }
  | { kind: "packet"; info: PacketInfo; x: number; y: number };

export interface Hover {
  id: string;
  label: string;
}

type Listener = () => void;

export const world = {
  mode: "story" as WorldMode,
  /** Story progress: 0..8, one unit per chapter. */
  chapter: 0,
  /**
   * The homepage camera flight: a position along the shot list in director.ts (KEYS), scrubbed by
   * each section's ScrollTrigger. -1 = no flight (other pages, or no section has claimed it).
   */
  journey: -1,
  /** The global Q-Day switch (lib/client/qday-switch): when it was thrown, or 0. Lasts 6 s. */
  qdayAt: 0,
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
  pinned: null as Pinned | null,
  /** The visible [data-world-focus] rectangle (CSS px), or null: the world only draws inside it. */
  focusRect: null as { left: number; top: number; width: number; height: number } | null,
  /** The one accent the current chapter may show ("accent" = protected, "warn" = vulnerable). */
  accent: "warn" as "accent" | "warn",
  /** Highlighted adapter socket on the globe (0..4), or -1. */
  socket: -1,
  showPulseKinds: { saffron: true, cyan: true },
  /** City ripples (packets landing), drained by the scene: sealed ones in the accent, classical in warn. */
  ripples: [] as { city: string; at: number; tone?: "accent" | "warn" }[],
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
  /** Role colour of the soft glow behind the globe (null = none). Set by the section on screen. */
  glow: null as null | "kem" | "sig" | "ok" | "warn" | "danger",
  /** Demo 2's directed shot: camera pose, land relief (0..1), the node in focus and its dot model. */
  shot: null as null | { pose: Pose; extrude: number; focus: string | null; model: boolean },
  /** Screen position (CSS px) of the focused node, written by the scene each frame (null = off stage). */
  focusScreen: null as { x: number; y: number } | null,
  /** Demo 2: a node clicked on the globe, to dive into (the demo clears it). */
  dive: null as string | null,
  /**
   * Demo 2: an adapter seating into a node's socket. `at` when it appeared (performance.now()),
   * `done` when the real deploy finished (0 while it runs: the adapter lowers, then clicks home).
   */
  seat: null as null | { site: string; adapter: string; at: number; done: number },
  /** Demo 2's last impact on the globe's post-processing (chromatic aberration): when and how hard. */
  fxHit: { at: 0, s: 0 },
  /** Demo 2's "all sealed" wave: when it started (performance.now()), 0 = none. */
  waveAt: 0,
  /** Live sealed-operation counts per route city (from /api/metrics), for the city light pillars. */
  cityOps: {} as Record<string, number>,
  /** Audience packets from the room (phones), drained by RoomArcs: city of origin, colour, verdict. */
  /**
   * The Readiness Index section: one bar per sector rising out of India (heights 0..1, `good` = taller
   * is better), shown while the section is on screen. `at` restarts the rise when the measure changes.
   */
  index: null as null | { values: number[]; good: boolean; at: number },
  /** Screen positions (CSS px) of the index bars' tips, written by the scene each frame. */
  indexScreen: [] as (null | { x: number; y: number })[],
  roomShots: [] as { city: string; colour: number; ok: boolean; at: number }[],
};

const listeners = new Set<Listener>();
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function notify(): void {
  listeners.forEach((fn) => fn());
}

export function setPinned(p: Pinned | null): void {
  world.pinned = p;
  notify();
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
