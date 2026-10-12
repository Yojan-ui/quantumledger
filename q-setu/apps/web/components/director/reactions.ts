"use client";

import { useEffect, useRef } from "react";
import { onLive } from "@/lib/client/live";
import type { OpEvent } from "@/lib/live/types";

export type Reaction = "seal" | "verify" | "reject" | "rotate";

const KIND: Partial<Record<OpEvent["op"], Reaction>> = {
  SEAL: "seal",
  VERIFY: "verify",
  REJECT: "reject",
  ROTATE: "rotate",
  HANDSHAKE: "rotate",
};

/**
 * Real crypto events → micro-reactions. Returns a ref holding the performance.now() of the latest
 * event of each kind (only those `filter` accepts), which scene objects read to ripple, pulse, snap or
 * shatter. Nothing reacts to anything that didn't happen.
 */
export function useReactions(filter: (e: OpEvent) => boolean = () => true) {
  const last = useRef<Record<Reaction, number>>({ seal: 0, verify: 0, reject: 0, rotate: 0 });
  const f = useRef(filter);
  f.current = filter;
  useEffect(
    () =>
      onLive((e) => {
        const k = KIND[e.op];
        if (!k || (e.op === "VERIFY" && !e.ok) || !f.current(e)) return;
        last.current[e.ok || k !== "seal" ? k : "reject"] = performance.now();
      }),
    [],
  );
  return last;
}

/** 0→1→0 envelope over `ms` after `at` (0 when idle): drives a ripple or pulse. */
export const pulse = (at: number, ms = 600) => {
  if (!at) return 0;
  const t = (performance.now() - at) / ms;
  return t < 0 || t > 1 ? 0 : Math.sin(Math.PI * t);
};
