"use client";

/**
 * One EventSource per tab on /api/stream (the live bus), shared by the ticker, the globe, the
 * Compute Meter and the demo consoles. Browser-side crypto (Demo 1's handshake, Demo 2's edge
 * device) can be pushed in with `pushLocal`, so consoles show both halves of what's happening.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Metrics, OpEvent } from "@/lib/live/types";

type Listener = (e: OpEvent) => void;

const MAX = 400;
const events: OpEvent[] = [];
const listeners = new Set<Listener>();
const metricsListeners = new Set<() => void>();
let metrics: Metrics | undefined;
let es: EventSource | undefined;
let refs = 0;
let localSeq = 1e9;

function emit(e: OpEvent) {
  events.push(e);
  if (events.length > MAX) events.splice(0, events.length - MAX);
  listeners.forEach((fn) => fn(e));
}

function connect() {
  if (es || typeof window === "undefined") return;
  es = new EventSource("/api/stream");
  es.onmessage = (m) => emit(JSON.parse(m.data) as OpEvent);
  es.addEventListener("metrics", (m) => {
    metrics = JSON.parse((m as MessageEvent<string>).data) as Metrics;
    metricsListeners.forEach((fn) => fn());
  });
}

function retain(): () => void {
  refs++;
  connect();
  return () => {
    refs--;
    // Keep the connection across route changes; close only when nothing has used it for a while.
    setTimeout(() => {
      if (refs === 0) {
        es?.close();
        es = undefined;
      }
    }, 5000);
  };
}

/** Subscribes to every live event (server and local). Keeps the stream open while mounted. */
export function onLive(fn: Listener): () => void {
  const release = retain();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
    release();
  };
}

/** Publishes an operation that happened in this browser. */
export function pushLocal(
  e: Omit<OpEvent, "seq" | "at" | "source"> & { source?: OpEvent["source"] },
) {
  emit({ source: "browser", ...e, seq: ++localSeq, at: Date.now() });
}

export function recentLive(): OpEvent[] {
  return [...events];
}

/** Subscribes to the rolling metrics frames (once a second). Keeps the stream open while subscribed. */
export function onMetrics(fn: (m: Metrics) => void): () => void {
  const release = retain();
  const l = () => metrics && fn(metrics);
  metricsListeners.add(l);
  return () => {
    metricsListeners.delete(l);
    release();
  };
}

/** The latest rolling metrics frame from the server (once a second). */
export function useMetrics(): Metrics | undefined {
  useEffect(() => retain(), []);
  return useSyncExternalStore(
    (fn) => {
      metricsListeners.add(fn);
      return () => void metricsListeners.delete(fn);
    },
    () => metrics,
    () => undefined,
  );
}

/** The newest `max` events that pass `filter`, newest last. `paused` freezes the list. */
export function useLiveEvents(
  filter: (e: OpEvent) => boolean = () => true,
  max = 50,
  paused = false,
) {
  const [list, setList] = useState<OpEvent[]>([]);
  useEffect(() => {
    if (paused) return;
    setList(recentLive().filter(filter).slice(-max));
    let pending: OpEvent[] = [];
    let raf = 0;
    const off = onLive((e) => {
      if (!filter(e)) return;
      pending.push(e);
      // Batch to one render per frame, however busy the bus is.
      raf ||= requestAnimationFrame(() => {
        raf = 0;
        const add = pending;
        pending = [];
        setList((l) => [...l, ...add].slice(-max));
      });
    });
    return () => {
      off();
      cancelAnimationFrame(raf);
    };
    // `filter` is expected to be stable (module-level or memoised).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max, paused]);
  return list;
}
