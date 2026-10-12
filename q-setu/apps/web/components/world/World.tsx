"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { Arcs } from "./Arcs";
import { Globe } from "./Globe";
import { Nodes } from "./Nodes";
import { Rig } from "./Rig";
import { ScanArc } from "./ScanArc";
import type { Dots } from "./shapes";
import { world } from "./store";

/**
 * Render the main world ourselves (drei <View>s in Demos 1 and 3 take over R3F's loop), scissored to
 * the page's globe area so the globe can never draw over text.
 */
function RenderMain() {
  useFrame(({ gl, scene, camera, size }) => {
    gl.setScissorTest(false);
    gl.autoClear = false;
    gl.clear();
    const r = world.focusRect;
    if (r) {
      // drei <View>s leave the viewport set to their own rectangle; the world needs the whole canvas.
      gl.setViewport(0, 0, size.width, size.height);
      gl.setScissor(r.left, size.height - r.top - r.height, r.width, r.height);
      gl.setScissorTest(true);
      gl.render(scene, camera);
      gl.setScissorTest(false);
    }
  }, 1);
  return null;
}

export function World({ dots }: { dots: Dots }) {
  const globe = useRef<THREE.Group>(null);
  return (
    <>
      <RenderMain />
      <Rig globe={globe} />
      <group ref={globe}>
        <Globe dots={dots} />
        <Arcs />
        <Nodes />
        <ScanArc />
      </group>
    </>
  );
}
