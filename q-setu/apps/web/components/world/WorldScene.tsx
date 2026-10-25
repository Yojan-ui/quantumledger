"use client";

import { PerformanceMonitor, Preload, View } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useRef } from "react";
import {
  any3dOnScreen,
  dprCap,
  gfx,
  isSoftwareRenderer,
  markGfxKnown,
  onlyAmbientOnScreen,
  setLost,
  setQuality,
  setSlow,
  useGfx,
} from "@/lib/client/gfx";
import { hero } from "@/lib/client/hero";
import { SceneBoundary } from "./SceneBoundary";
import type { Dots } from "./shapes";
import { World } from "./World";

/** On a slow device: at most one frame per SLOW_FRAME_MS (~20 fps)... */
const SLOW_FRAME_MS = 50;
/** ...and none once the idle hero is all that's on screen and nobody has moved for REST_MS. */
const REST_MS = 3000;
const WAKE = ["scroll", "wheel", "pointermove", "pointerdown", "touchstart", "keydown", "resize"];

/**
 * Renders only while some 3D area is on screen (frameloop "demand" + this driver), so an all-text
 * stretch of a page costs no GPU time. On a slow device (gfx.slow) it eases off: frames are capped,
 * and the idle hero's ambient drift stops after a few still seconds (the last frame stays up) until
 * the visitor scrolls, points or types. Films, demos and the globe's arcs are never paused, only
 * capped: their next beat waits on frames.
 */
function Driver() {
  const invalidate = useThree((s) => s.invalidate);
  const last = useRef(0);
  const moved = useRef(0);
  useEffect(() => {
    moved.current = performance.now();
    const wake = () => (moved.current = performance.now());
    for (const t of WAKE) window.addEventListener(t, wake, { passive: true });
    document.addEventListener("visibilitychange", wake);
    // On GSAP's ticker, after Lenis has moved the page: the 3D draws on the same clock as the scroll.
    const tick = () => {
      if (!any3dOnScreen()) return;
      if (!gfx.slow) return invalidate();
      const now = performance.now();
      if (now - last.current < SLOW_FRAME_MS) return;
      const resting =
        now - moved.current > REST_MS && hero.phase === "idle" && onlyAmbientOnScreen();
      document.documentElement.toggleAttribute("data-gfx-rest", resting);
      if (resting) return;
      last.current = now;
      invalidate();
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      for (const t of WAKE) window.removeEventListener(t, wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [invalidate]);
  // The ticker alone draws only every other frame: R3F stops its loop after a frame nothing asked
  // to follow, and a restart from the ticker lands a frame late. A request made inside a frame
  // books the next one, so the loop keeps going while 3D is on screen (GSAP still runs first).
  // A slow device runs on the ticker alone, which paces it.
  useFrame(() => {
    if (!gfx.slow && any3dOnScreen()) invalidate();
  });
  return null;
}

/**
 * The site's single WebGL canvas, mounted in the root layout so it survives route changes.
 * Context loss: every 3D area shows its static poster (html[data-gl-lost]); `onLost` asks the
 * wrapper to rebuild the canvas once the browser restores the context.
 */
export default function WorldScene({ dots, onRestored }: { dots: Dots; onRestored: () => void }) {
  const quality = useGfx((s) => s.quality);
  return (
    <Canvas
      style={{ position: "fixed", inset: 0, pointerEvents: "none" }}
      eventSource={typeof document !== "undefined" ? document.body : undefined}
      eventPrefix="client"
      flat
      frameloop="demand"
      dpr={[1, dprCap(quality)]}
      camera={{ position: [0, 0, 3], fov: 36, near: 0.05, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        // No GPU: WebGL is drawn on the CPU, so ease off from the first frame.
        if (isSoftwareRenderer(gl.getContext())) setSlow();
        markGfxKnown();
        const canvas = gl.domElement;
        canvas.addEventListener("webglcontextlost", (e) => {
          // preventDefault tells the browser we will handle restoration.
          e.preventDefault();
          setLost(true);
        });
        canvas.addEventListener("webglcontextrestored", () => onRestored());
      }}
    >
      {/* fps falls: lower DPR, then fewer particles, then no focus dimming or halos (and back up).
          Still falling at the bottom of the ladder: the device is slow, and the canvas eases off. */}
      <PerformanceMonitor
        flipflops={6}
        onDecline={() => (gfx.quality >= 3 ? setSlow() : setQuality(gfx.quality + 1))}
        onIncline={() => !gfx.slow && setQuality(gfx.quality - 1)}
      />
      <Driver />
      <SceneBoundary>
        <World dots={dots} />
      </SceneBoundary>
      <View.Port />
      {/* Compile shaders and upload textures before anything first appears. */}
      <Preload all />
    </Canvas>
  );
}
