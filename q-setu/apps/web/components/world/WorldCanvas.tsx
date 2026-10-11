"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Dots } from "./shapes";

const WorldScene = dynamic(() => import("./WorldScene"), { ssr: false, loading: () => null });

/**
 * Mounted once in the root layout. After load (when the browser is idle) a worker samples the land
 * dots and the world mounts. It only ever draws inside a page's [data-world-focus] area.
 */
export function WorldCanvas() {
  const [dots, setDots] = useState<Dots>();
  useEffect(() => {
    const c = document.createElement("canvas");
    if (!(c.getContext("webgl2") || c.getContext("webgl"))) return;
    const small = window.innerWidth < 768;
    let worker: Worker | undefined;
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      worker = new Worker(new URL("./world.worker.ts", import.meta.url));
      worker.onmessage = (e: MessageEvent<{ dots: Dots }>) => {
        if (!cancelled) setDots(e.data.dots);
        worker?.terminate();
      };
      worker.postMessage({ maskUrl: "/globe/landmask.png", candidates: small ? 60_000 : 120_000 });
    };
    // The 3D bundle loads after first paint. Desktops start it when the browser is idle; phones and
    // low-core devices wait for the first interaction (or 4.5 s), so the scene's start-up never
    // competes with the page becoming usable.
    const constrained =
      window.matchMedia("(pointer: coarse)").matches ||
      window.innerWidth < 768 ||
      (navigator.hardwareConcurrency ?? 8) <= 4;
    const events = [
      "pointerdown",
      "pointermove",
      "touchstart",
      "scroll",
      "keydown",
      "wheel",
    ] as const;
    let fired = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const go = () => {
      if (fired) return;
      fired = true;
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, go));
      start();
    };
    const idle = () => {
      if (constrained) {
        events.forEach((e) => window.addEventListener(e, go, { once: true, passive: true }));
        timer = setTimeout(go, 4500);
        return;
      }
      const w = window as Window & typeof globalThis;
      if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(go, { timeout: 1500 });
      else setTimeout(go, 200);
    };
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
    return () => {
      cancelled = true;
      worker?.terminate();
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, go));
      window.removeEventListener("load", idle);
    };
  }, []);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      {dots && <WorldScene dots={dots} />}
    </div>
  );
}
