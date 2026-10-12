"use client";

import { PerformanceMonitor, Preload, View } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect } from "react";
import { any3dOnScreen, DPR, gfx, setLost, setQuality, useGfx } from "@/lib/client/gfx";
import type { Dots } from "./shapes";
import { World } from "./World";

/**
 * Renders only while some 3D area is on screen (frameloop "demand" + this driver), so an all-text
 * stretch of a page costs no GPU time.
 */
function Driver() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    // On GSAP's ticker, after Lenis has moved the page: the 3D draws on the same clock as the scroll.
    const tick = () => {
      if (any3dOnScreen()) invalidate();
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [invalidate]);
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
      dpr={[1, DPR[quality]]}
      camera={{ position: [0, 0, 3], fov: 36, near: 0.05, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        const canvas = gl.domElement;
        canvas.addEventListener("webglcontextlost", (e) => {
          // preventDefault tells the browser we will handle restoration.
          e.preventDefault();
          setLost(true);
        });
        canvas.addEventListener("webglcontextrestored", () => onRestored());
      }}
    >
      {/* fps falls: lower DPR, then fewer particles, then no focus dimming or halos (and back up). */}
      <PerformanceMonitor
        flipflops={6}
        onDecline={() => setQuality(gfx.quality + 1)}
        onIncline={() => setQuality(gfx.quality - 1)}
      />
      <Driver />
      <World dots={dots} />
      <View.Port />
      {/* Compile shaders and upload textures before anything first appears. */}
      <Preload all />
    </Canvas>
  );
}
