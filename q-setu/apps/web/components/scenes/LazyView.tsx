"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";

// drei's View (and with it three.js) loads only when a scene first scrolls near.
const SceneView = dynamic(() => import("@/components/world/SceneView").then((m) => m.SceneView), {
  ssr: false,
});

/**
 * A 3D window in the site's single WebGL canvas (drei View) that mounts only when it first comes
 * near the viewport, and tells its scene whether it's on screen so animation can pause.
 */
export function LazyView({
  className,
  label,
  children,
}: {
  className: string;
  label: string;
  children: (onScreen: boolean) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => {
        const on = !!e?.isIntersecting;
        setOnScreen(on);
        if (on) setMounted(true);
      },
      { rootMargin: "200px 0px" },
    );
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} role="img" aria-label={label} className={`relative ${className}`}>
      {mounted && <SceneView className="absolute inset-0">{children(onScreen)}</SceneView>}
    </div>
  );
}
