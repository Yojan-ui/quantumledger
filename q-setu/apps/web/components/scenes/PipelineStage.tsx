"use client";

/** Placeholder for the five-stage pipeline scene (built next): a camera and the grid floor. */
import { PerspectiveCamera } from "@react-three/drei";
import { useMemo } from "react";
import { palette } from "@/components/world/palette";
import type { PipelineState } from "@/lib/client/pipeline";

export default function PipelineStage({ active }: { state: PipelineState; active: boolean }) {
  const c = useMemo(palette, []);
  void active;
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 2, 8]} fov={40} />
      <gridHelper args={[40, 80, c.text3, c.text3]} position={[0, -1.5, 0]} />
    </>
  );
}
