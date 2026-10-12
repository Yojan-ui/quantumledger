"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { invalidateAreas } from "@/lib/client/gfx";

// drei's View (and with it three.js) loads only when a scene first scrolls near.
const SceneView = dynamic(() => import("@/components/world/SceneView").then((m) => m.SceneView), {
  ssr: false,
});

/**
 * The static stand-in for a 3D scene: a faint wireframe sphere and floor in the scene's own frame.
 * Shown while the 3D loads (then crossfaded out in 300 ms on the scene's first frame) and again if
 * the GL context is lost, with "Restoring 3D…", until the canvas is rebuilt. Never a blank box.
 */
export function GlPoster() {
  return (
    <div
      data-gl-poster
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300"
    >
      <svg
        viewBox="0 0 200 120"
        className="h-3/5 w-3/5 text-line-strong"
        fill="none"
        stroke="currentColor"
      >
        <ellipse cx="100" cy="58" rx="34" ry="34" />
        <ellipse cx="100" cy="58" rx="34" ry="11" />
        <ellipse cx="100" cy="58" rx="12" ry="34" />
        <path d="M20 104h160M40 112h120" />
      </svg>
      <span
        data-gl-lost-note
        className="absolute bottom-3 font-mono text-micro uppercase text-fg-3"
      >
        Restoring 3D…
      </span>
    </div>
  );
}

/**
 * A 3D window in the site's single WebGL canvas (drei View) that mounts only when it first comes
 * near the viewport, and tells its scene whether it's on screen so animation can pause. The box keeps
 * its size from the first paint (no layout shift); a poster holds the frame until the scene draws.
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
  // The frame driver renders only while some View is on screen (see lib/client/gfx).
  useEffect(() => {
    ref.current?.toggleAttribute("data-view-on", mounted && onScreen);
    invalidateAreas();
  }, [mounted, onScreen]);
  const ready = useCallback(() => ref.current?.setAttribute("data-ready", ""), []);
  return (
    <div ref={ref} data-3d role="img" aria-label={label} className={`relative ${className}`}>
      {mounted && (
        <SceneView className="absolute inset-0" onReady={ready}>
          {children(onScreen)}
        </SceneView>
      )}
      <GlPoster />
    </div>
  );
}
