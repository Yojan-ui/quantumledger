"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { notify, world, type Pose, type WorldMode } from "./store";

/** Each content page has its own camera: the globe persists and eases between them. */
const POSES: Record<string, Pose> = {
  "/platform": { lat: 12, lon: 60, dist: 3.8, spin: 0.05 },
  "/solutions": { lat: 20, lon: 78, dist: 2.6, spin: 0.02 },
  "/solutions/fintech": { lat: 19.1, lon: 72.9, dist: 1.7, spin: 0 },
  "/solutions/healthcare": { lat: 28.6, lon: 77.2, dist: 2.0, spin: 0 },
  "/solutions/education": { lat: 13.0, lon: 77.6, dist: 1.7, spin: 0 },
  "/solutions/government": { lat: 28.6, lon: 77.2, dist: 1.55, spin: 0 },
  "/about": { lat: 22, lon: 79, dist: 2.4, spin: 0.03 },
  "/pitch": { lat: 18, lon: 76, dist: 2.9, spin: 0.05 },
};

/** Maps the route to a world mode. Navigating between pages becomes a camera move in the same world. */
export function RouteSync() {
  const path = usePathname();
  useEffect(() => {
    const pose = POSES[path];
    const mode: WorldMode =
      path === "/"
        ? "story"
        : path.startsWith("/demo/deploy")
          ? "deploy"
          : pose
            ? "page"
            : "backdrop";
    world.mode = mode;
    world.pagePose = pose ?? null;
    if (mode !== "story") world.chapter = 0;
    world.hover = null;
    notify();
  }, [path]);
  return null;
}
