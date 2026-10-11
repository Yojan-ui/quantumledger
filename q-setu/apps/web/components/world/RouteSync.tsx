"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { notify, world, type WorldMode } from "./store";

/** Maps the route to a world mode. Navigating between pages becomes a camera move in the same world. */
export function RouteSync() {
  const path = usePathname();
  useEffect(() => {
    const mode: WorldMode =
      path === "/" ? "story" : path.startsWith("/demo/deploy") ? "deploy" : "backdrop";
    world.mode = mode;
    if (mode !== "story") world.chapter = 0;
    world.hover = null;
    notify();
  }, [path]);
  return null;
}
