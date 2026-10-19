"use client";

/**
 * Shared graphics state for the site's one WebGL canvas.
 *  - quality: the adaptive ladder. PerformanceMonitor steps it up when fps drops, in this order:
 *      0 full · 1 lower DPR (1.25) · 2 no dust layer, half the particles · 3 no glass transmission,
 *      no line glow, focus dimming or halos (DPR 1).
 *  - lost: the GL context was lost; 3D areas show their static poster until it is rebuilt.
 */
import { useSyncExternalStore } from "react";

export type Quality = 0 | 1 | 2 | 3;
export const DPR: Record<Quality, number> = { 0: 1.75, 1: 1.25, 2: 1.25, 3: 1 };

const state = { quality: 0 as Quality, lost: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const gfx = state;

export function setQuality(q: number) {
  const next = Math.max(0, Math.min(3, q)) as Quality;
  if (next === state.quality) return;
  state.quality = next;
  emit();
}

export function setLost(lost: boolean) {
  if (lost === state.lost) return;
  state.lost = lost;
  document.documentElement.toggleAttribute("data-gl-lost", lost);
  emit();
}

export function useGfx<T>(select: (s: typeof state) => T): T {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    () => select(state),
    () => select({ quality: 0, lost: false }),
  );
}

/** True if any 3D area (the globe's focus area or a mounted View) is on screen. */
let areas: HTMLElement[] | null = null;
let watching = false;
/** Re-query the 3D areas on the next frame (the DOM changed, or a View came on/off screen). */
export function invalidateAreas() {
  areas = null;
}
export function any3dOnScreen(): boolean {
  const h = window.innerHeight;
  // The element list is cached and re-queried only after the DOM changes; per frame, only the
  // rectangles are read.
  if (!watching) {
    watching = true;
    new MutationObserver(invalidateAreas).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
  areas ??= [...document.querySelectorAll<HTMLElement>("[data-world-focus], [data-view-on]")];
  for (const el of areas) {
    const r = el.getBoundingClientRect();
    if (r.bottom > 0 && r.top < h && r.width > 0 && r.height > 0) return true;
  }
  return false;
}
