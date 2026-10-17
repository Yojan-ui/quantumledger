"use client";

import { View } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import type * as THREE from "three";
import { SceneBoundary } from "./SceneBoundary";

/**
 * Compiles every shader a scene will ever draw, so nothing hitches later. three's compile only walks
 * visible objects, and much of a film is hidden until its moment (the crystal, the glass blocks, the
 * cracked halves, the shield), so everything is made visible for the compile and put back.
 */
export function compileAll(gl: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera) {
  const hidden: THREE.Object3D[] = [];
  const mats: THREE.Material[] = [];
  scene.traverse((o) => {
    if (!o.visible) {
      hidden.push(o);
      o.visible = true;
    }
    const m = (o as THREE.Mesh).material;
    for (const x of Array.isArray(m) ? m : m ? [m] : [])
      if (!x.visible) {
        mats.push(x);
        x.visible = true;
      }
  });
  try {
    // compileAsync requests every program now (the visibility flip only has to last for this
    // call) and lets the driver compile them in parallel (KHR_parallel_shader_compile), so the
    // main thread isn't blocked; it falls back to a plain compile where unsupported.
    const r = gl as unknown as {
      compileAsync?: (s: THREE.Object3D, c: THREE.Camera) => Promise<unknown>;
    };
    if (r.compileAsync) void r.compileAsync(scene, camera).catch(() => {});
    else gl.compile(scene, camera);
  } catch {
    /* compiled lazily on first render instead */
  }
  hidden.forEach((o) => (o.visible = false));
  mats.forEach((x) => (x.visible = false));
}

/** Compiles the View's scene on mount and again once lazily-loaded parts are in. */
function Precompile() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    compileAll(gl, scene, camera);
    const t = setTimeout(() => compileAll(gl, scene, camera), 1200);
    return () => clearTimeout(t);
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
  onFail,
}: {
  children: ReactNode;
  className?: string;
  onReady?: () => void;
  onFail?: () => void;
}) {
  return (
    <View className={className}>
      {/* A scene that fails draws nothing and calls onFail, so its area shows the poster again. */}
      <SceneBoundary onError={onFail}>
        {children}
        <Precompile />
        {onReady && <FirstFrame onReady={onReady} />}
      </SceneBoundary>
    </View>
  );
}
