"use client";

/**
 * The big screen's view of the room: one EventSource on /api/room/stream per tab. Every sealed or
 * rejected packet is also queued for the globe (world.roomShots), which flies it as an arc.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import type { RoomEvent, RoomStats } from "@/lib/live/room";
import { world } from "@/components/world/store";
import { openStream } from "@/lib/client/server";

type Listener = (e: RoomEvent) => void;
const listeners = new Set<Listener>();
const statListeners = new Set<() => void>();
let stats: RoomStats | undefined;
let close: (() => void) | undefined;
let refs = 0;

function connect() {
  if (close || typeof window === "undefined") return;
  close = openStream("/api/room/stream", (es) => {
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as RoomEvent;
      if (e.kind !== "join")
        world.roomShots.push({
          city: e.visitor.city,
          colour: e.visitor.colour,
          ok: e.kind === "sealed",
          at: 0,
        });
      listeners.forEach((fn) => fn(e));
    };
    es.addEventListener("stats", (m) => {
      stats = JSON.parse((m as MessageEvent<string>).data) as RoomStats;
      statListeners.forEach((fn) => fn());
    });
  });
}

function retain() {
  refs++;
  connect();
  return () => {
    refs--;
    setTimeout(() => {
      if (refs === 0) {
        close?.();
        close = undefined;
      }
    }, 5000);
  };
}

export function onRoom(fn: Listener): () => void {
  const release = retain();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
    release();
  };
}

export function useRoomStats(): RoomStats | undefined {
  useEffect(() => retain(), []);
  return useSyncExternalStore(
    (fn) => {
      statListeners.add(fn);
      return () => void statListeners.delete(fn);
    },
    () => stats,
    () => undefined,
  );
}

/** The URL phones should open (LAN address in dev, the deployed URL in production). */
export function useJoinUrl(): { url: string; lan: boolean } | undefined {
  const [u, setU] = useState<{ url: string; lan: boolean }>();
  useEffect(() => {
    let off = false;
    fetch("/api/room")
      .then((r) => r.json())
      .then((j) => !off && setU(j.join))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, []);
  return u;
}
