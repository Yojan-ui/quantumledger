"use client";

import { View } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";

/** Compiles the View's shaders as soon as its scene has mounted, so its first frame doesn't hitch. */
function Precompile() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    try {
      gl.compile(scene, camera);
    } catch {
      /* compiled lazily on first render instead */
    }
  }, [gl, scene, camera]);
  return null;
}

/** Calls `onReady` once, after the View's first rendered frame (a DOM write, not React state). */
function FirstFrame({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    onReady();
  });
  return null;
}

/**
 * A window into the site's single WebGL canvas. Demo scenes render here through drei's <View>
 * (scissored into this element's rectangle), so the whole site keeps one GL context.
 */
export function SceneView({
  children,
  className,
  onReady,
}: {
  children: ReactNode;
  className?: string;
  onReady?: () => void;
}) {
  return (
    <View className={className}>
      {children}
      <Precompile />
      {onReady && <FirstFrame onReady={onReady} />}
    </View>
  );
}
