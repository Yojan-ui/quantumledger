"use client";

import { PerformanceMonitor, View } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import type { Dots } from "./shapes";
import { World } from "./World";

/** The site's single WebGL canvas, mounted in the root layout so it survives route changes. */
export default function WorldScene({ dots }: { dots: Dots }) {
  const [dpr, setDpr] = useState(1.75);
  return (
    <Canvas
      style={{ position: "fixed", inset: 0, pointerEvents: "none" }}
      eventSource={typeof document !== "undefined" ? document.body : undefined}
      eventPrefix="client"
      flat
      dpr={[1, dpr]}
      camera={{ position: [0, 0, 3], fov: 36, near: 0.05, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.75)} />
      <World dots={dots} />
      <View.Port />
    </Canvas>
  );
}
