"use client";

import dynamic from "next/dynamic";
import { chunkFailed } from "@/lib/client/chunk";
import { useCallback, useEffect, useRef, useState } from "react";
import { setLost, softwareGL } from "@/lib/client/gfx";
import { SceneBoundary } from "./SceneBoundary";
import { world } from "./store";
import type { Dots } from "./shapes";
import { usePathname } from "next/navigation";

const WorldScene = dynamic(
  () =>
    import("./WorldScene")
      .catch(() => import("./WorldScene"))

      .catch(chunkFailed),
  {
    ssr: false,
    loading: () => null,
  },
);

/**
 * Mounted once in the root layout. After load (when the browser is idle) a worker samples the land
 * dots and the world mounts. It only ever draws inside a page's [data-world-focus] area.
 */
/**
 * The ambient tint behind the globe: a soft radial glow in the current section's role colour (12%,
 * at most 900px wide), centred on the globe's area. It sits under the canvas, so it is truly behind.
 */
function GlobeGlow() {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    let last = "";
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const d = el.current;
      const r = world.focusRect;
      if (!d) return;
      const role = r ? world.glow : null;
      const key =
        role && r
          ? `${role}|${Math.round(r.left)}|${Math.round(r.top)}|${Math.round(r.width)}|${Math.round(r.height)}`
          : "";
      if (key === last) return;
      last = key;
      if (!role || !r) {
        d.style.opacity = "0";
        return;
      }
      const size = Math.min(900, Math.max(r.width, r.height) * 1.25);
      d.style.opacity = "1";
      // Moved and sized by transform only (no layout, no layout shift while the page scrolls).
      d.style.transform = `translate3d(${r.left + r.width / 2 - size / 2}px, ${r.top + r.height / 2 - size / 2}px, 0) scale(${size / 900})`;
      d.style.setProperty("--glow", `var(--${role})`);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <div ref={el} className="ambient opacity-0 transition-opacity duration-700" />;
}

/** Elements that draw into the canvas: the globe's focus areas, demo Views and the HUD stage. */
const THREE_D = "[data-world-focus], [data-3d], [data-hud-stage]";

export function WorldCanvas() {
  const [dots, setDots] = useState<Dots>();
  // Bumped when a lost context is restored: the canvas is rebuilt from scratch.
  const [build, setBuild] = useState(0);
  const restored = useCallback(() => {
    setTimeout(() => {
      setBuild((b) => b + 1);
      setLost(false);
    }, 300);
  }, []);
  const pathname = usePathname();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    // The phone page behind the QR code never needs the globe.
    if (location.pathname.startsWith("/join")) return;
    // Feature-detect without creating a context (a throwaway context still costs a GPU slot).
    if (
      typeof WebGL2RenderingContext === "undefined" &&
      typeof WebGLRenderingContext === "undefined"
    )
      return;
    // No GPU (WebGL in software): no canvas at all; every 3D area keeps its poster (gfx no3d).
    if (softwareGL()) return;
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
    // The 3D bundle loads after first paint, in idle time, and only on pages that have a 3D area.
    // The diagnostics HUD is the page's subject: its 3D stage starts at once, phones included.
    // Desktops start when idle. Phones and low-core devices wait until a 3D area comes within a
    // screen of the viewport, so the boot never lands on a page without 3D or on the first scroll.
    const constrained =
      window.matchMedia("(pointer: coarse)").matches ||
      window.innerWidth < 768 ||
      (navigator.hardwareConcurrency ?? 8) <= 4;
    const w = window as Window & typeof globalThis;
    let fired = false;
    let io: IntersectionObserver | undefined;
    let idleId = 0;
    const go = () => {
      if (fired) return;
      fired = true;
      started.current = true;
      io?.disconnect();
      start();
    };
    const whenIdle = (timeout: number) => {
      if (typeof w.requestIdleCallback === "function")
        idleId = w.requestIdleCallback(go, { timeout });
      else setTimeout(go, 200);
    };
    const begin = () => {
      if (document.querySelector("[data-hud-stage]")) return go();
      const areas = document.querySelectorAll(THREE_D);
      if (!areas.length) return;
      if (!constrained) return whenIdle(1500);
      io = new IntersectionObserver(
        (es) => {
          if (es.some((e) => e.isIntersecting)) {
            io?.disconnect();
            whenIdle(1000);
          }
        },
        { rootMargin: "100% 0px" },
      );
      areas.forEach((el) => io!.observe(el));
    };
    const idle = () => begin();
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
    // Re-checked on each route until the world has started (a 3D page reached by client navigation).
    // Once started, the worker is left to finish: the root layout never unmounts.
    return () => {
      window.removeEventListener("load", idle);
      if (fired) return;
      cancelled = true;
      io?.disconnect();
      if (idleId && typeof w.cancelIdleCallback === "function") w.cancelIdleCallback(idleId);
    };
  }, [pathname]);
  // ?nocanvas=1 hides the WebGL canvas (the motion pass's visual check: everything left is UI).
  const [nocanvas, setNocanvas] = useState(false);
  useEffect(() => setNocanvas(new URLSearchParams(location.search).get("nocanvas") === "1"), []);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden" data-world>
      {nocanvas && <style>{"[data-world] canvas { visibility: hidden !important; }"}</style>}
      <GlobeGlow />
      {dots && (
        <SceneBoundary>
          <WorldScene key={build} dots={dots} onRestored={restored} />
        </SceneBoundary>
      )}
    </div>
  );
}
