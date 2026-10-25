"use client";

/**
 * Shared graphics state for the site's one WebGL canvas.
 *  - quality: the adaptive ladder. PerformanceMonitor steps it up when fps drops, in this order:
 *      0 full · 1 lower DPR (1.25) · 2 no dust layer, half the particles · 3 no glass transmission,
 *      no line glow, focus dimming or halos (DPR 1).
 *  - lost: the GL context was lost; 3D areas show their static poster until it is rebuilt.
 *  - slow: this device can't keep up even at the bottom of the ladder (or draws WebGL in software).
 *      The canvas then eases off (components/world/WorldScene): ~20 fps, the hero's opening without
 *      its particle assembly and burst, and no frames at all while the idle hero is all that's on
 *      screen and nobody is scrolling, pointing or typing. html[data-gfx-slow] marks it.
 */
import { useSyncExternalStore } from "react";

export type Quality = 0 | 1 | 2 | 3;
export const DPR: Record<Quality, number> = { 0: 1.5, 1: 1.25, 2: 1.25, 3: 1 };
/** Phones (< 768 px wide) never render above 1.5× however dense the screen: a 3× buffer costs
 * four times the fill rate of 1.5× for detail nobody sees at arm's length. */
export const PHONE_DPR_CAP = 1.5;
export const dprCap = (q: Quality) =>
  typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
    ? Math.min(PHONE_DPR_CAP, DPR[q])
    : DPR[q];

const state = { quality: 0 as Quality, lost: false, slow: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const gfx = state;

export function setQuality(q: number) {
  const next = Math.max(0, Math.min(3, q)) as Quality;
  if (next === state.quality) return;
  state.quality = next;
  emit();
}

/** Ease off for the rest of the page view (it never flips back: no stutter between modes). */
export function setSlow() {
  if (state.slow) return;
  state.slow = true;
  state.quality = 3;
  document.documentElement.setAttribute("data-gfx-slow", "");
  emit();
}

/** WebGL drawn on the CPU (no usable GPU): SwiftShader, llvmpipe, Microsoft's Basic Render Driver. */
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen/i;
export function isSoftwareRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
  return SOFTWARE.test(name);
}

let known: (() => void) | undefined;
const ready = new Promise<void>((r) => (known = r));
/** The canvas has its GL context, so `slow` already reflects a software renderer. */
export const markGfxKnown = () => known?.();
/** Resolves once the renderer is known (or after `ms`, if the canvas never comes). */
export const gfxKnown = (ms = 5000) =>
  Promise.race([ready, new Promise<void>((r) => setTimeout(r, ms))]);

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
    () => select({ quality: 0, lost: false, slow: false }),
  );
}

/** True if any 3D area (the globe's focus area or a mounted View) is on screen. */
let areas: HTMLElement[] | null = null;
let watching = false;
/** Re-query the 3D areas on the next frame (the DOM changed, or a View came on/off screen). */
export function invalidateAreas() {
  areas = null;
}
function allAreas(): HTMLElement[] {
  // The element list is cached and re-queried only after the DOM changes; per frame, only the
  // rectangles are read.
  if (!watching) {
    watching = true;
    new MutationObserver(invalidateAreas).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
  return (areas ??= [
    ...document.querySelectorAll<HTMLElement>("[data-world-focus], [data-view-on]"),
  ]);
}
const onScreen = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight && r.width > 0 && r.height > 0;
};
export const any3dOnScreen = () => allAreas().some(onScreen);

/**
 * True if every 3D area on screen sits in a [data-ambient] stage: one whose motion is only drift,
 * so a slow device may stop drawing it while nothing happens (WorldScene's Driver).
 */
export const onlyAmbientOnScreen = () =>
  allAreas()
    .filter(onScreen)
    .every((el) => el.closest("[data-ambient]"));
