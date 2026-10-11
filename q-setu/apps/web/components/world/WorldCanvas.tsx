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
    const idle = () => {
      const w = window as Window & typeof globalThis;
      if (typeof w.requestIdleCallback === "function")
        w.requestIdleCallback(start, { timeout: 1500 });
      else setTimeout(start, 200);
    };
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
    return () => {
      cancelled = true;
      worker?.terminate();
      window.removeEventListener("load", idle);
    };
  }, []);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      {dots && <WorldScene dots={dots} />}
    </div>
  );
}
