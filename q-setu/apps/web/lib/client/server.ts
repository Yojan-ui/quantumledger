"use client";

/**
 * The browser's view of the API's health, shared by every live stream and the status note:
 *  - "waking": the first health check is taking a while (a host spinning up after sleeping)
 *  - "down": it failed; the note offers a retry
 *  - "reconnecting": a live stream dropped and is backing off before it reconnects
 * Streams reconnect on their own with exponential backoff (0.5 s doubling to 8 s, with jitter).
 */
import { useSyncExternalStore } from "react";

export type ServerStatus = "ok" | "waking" | "down" | "reconnecting";

let status: ServerStatus = "ok";
const listeners = new Set<() => void>();
const dropped = new Set<string>();

function set(s: ServerStatus) {
  if (s === status) return;
  status = s;
  listeners.forEach((fn) => fn());
}

export function useServerStatus(): ServerStatus {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    () => status,
    () => "ok",
  );
}

/** Pings /api/health; reports "waking" after 2 s without an answer and "down" if it fails. */
export async function checkHealth(): Promise<boolean> {
  const slow = setTimeout(() => status === "ok" && set("waking"), 2000);
  try {
    const r = await fetch("/api/health", {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) throw new Error(String(r.status));
    set(dropped.size ? "reconnecting" : "ok");
    return true;
  } catch {
    set("down");
    return false;
  } finally {
    clearTimeout(slow);
  }
}

/**
 * An EventSource that reconnects with backoff and reports "reconnecting" while it's down.
 * `setup` attaches handlers to each new connection. Returns `close`.
 */
export function openStream(url: string, setup: (es: EventSource) => void): () => void {
  let es: EventSource | undefined;
  let delay = 500;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  const open = () => {
    es = new EventSource(url);
    setup(es);
    es.addEventListener("open", () => {
      delay = 500;
      dropped.delete(url);
      if (!dropped.size && status === "reconnecting") set("ok");
    });
    es.addEventListener("error", () => {
      if (closed) return;
      // Take over from the browser's fixed retry: close, back off, reopen.
      es?.close();
      dropped.add(url);
      if (status === "ok") set("reconnecting");
      timer = setTimeout(open, delay * (0.8 + Math.random() * 0.4));
      delay = Math.min(8000, delay * 2);
    });
  };
  open();
  return () => {
    closed = true;
    clearTimeout(timer);
    es?.close();
    dropped.delete(url);
    if (!dropped.size && status === "reconnecting") set("ok");
  };
}
