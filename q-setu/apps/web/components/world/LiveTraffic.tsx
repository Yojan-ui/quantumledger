"use client";

/**
 * Feeds the globe from the live bus. A mesh transaction becomes one pulse on its route once the
 * receiver has answered: it travels for a time derived from the measured latency (sign + seal +
 * open), arrives with a ripple, or, if AES-GCM rejected it, snaps halfway. Simulator hops (the
 * Q-Day demo's recorded traffic) pulse straight away.
 *
 * While the story is on screen it also trickles simulated sector traffic, so the eavesdropper has
 * recordings for the Q-Day chapter to break.
 */
import { useEffect } from "react";
import { ROUTES } from "@/data/routes";
import { onLive, onMetrics } from "@/lib/client/live";
import type { OpEvent } from "@/lib/live/types";
import { world, type PacketInfo } from "./store";

const speedFor = (ms: number) => 1 / (1.1 + Math.min(3, ms / 12));

/** The fields a clicked packet shows: all measured by the bus, none invented. */
function packetInfo(e: OpEvent, ms = e.ms): PacketInfo {
  return {
    seq: e.seq,
    op: e.op,
    alg: e.alg,
    ms,
    bytes: e.bytes,
    from: e.from,
    to: e.to,
    sim: e.source === "sim",
  };
}

export function LiveTraffic() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    world.breathe = !reduce;
    const pending = new Map<number, number>();
    const handle = (e: OpEvent) => {
      if (e.route === undefined || !ROUTES[e.route]) return;
      const r = ROUTES[e.route]!;
      if (e.source === "sim") {
        if (e.op === "SEAL" && !reduce)
          world.pulses.push({
            arc: e.route,
            color: "cyan",
            speed: speedFor(e.ms),
            arriveAt: r.to,
            info: packetInfo(e),
          });
        return;
      }
      if (e.op === "SIGN") pending.set(e.route, e.ms);
      else if (e.op === "SEAL") pending.set(e.route, (pending.get(e.route) ?? 0) + e.ms);
      else if (e.op === "OPEN" || e.op === "REJECT") {
        const total = (pending.get(e.route) ?? 0) + e.ms;
        pending.delete(e.route);
        if (reduce) return;
        world.pulses.push({
          arc: e.route,
          color: "cyan",
          speed: speedFor(total),
          doomed: e.op === "REJECT",
          arriveAt: e.op === "OPEN" ? r.to : undefined,
          info: packetInfo(e, total),
        });
        if (world.pulses.length > 64) world.pulses.splice(0, world.pulses.length - 64);
      }
    };
    const off = onLive(handle);
    // City light pillars: sealed operations per city in the last 60 s.
    const offMetrics = onMetrics((m) => {
      world.cityOps = Object.fromEntries(Object.entries(m.byCity).map(([k, v]) => [k, v.sealed]));
    });

    const sectors = ["fintech"];
    let n = 0;
    const tick = setInterval(() => {
      if (document.hidden || world.mode !== "story") return;
      void fetch("/api/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sector: sectors[n++ % 3], count: 1, paceMs: 700 }),
      }).catch(() => {});
    }, 6000);
    return () => {
      off();
      offMetrics();
      clearInterval(tick);
    };
  }, []);
  return null;
}
