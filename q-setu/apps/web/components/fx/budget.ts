"use client";

/**
 * What the demo stages may spend, from the site's adaptive quality ladder (lib/client/gfx: drei's
 * PerformanceMonitor steps it down when fps falls, and back up). Phones start one step down.
 *   0: everything · 1: fewer particles, half-res bloom · 2: no reflections, no depth of field,
 *   no contact shadows · 3: no post-processing at all (the scene draws straight to the canvas).
 */
import { gfx, useGfx, type Quality } from "@/lib/client/gfx";

export interface Budget {
  level: number;
  particles: number;
  post: boolean;
  bloomScale: number;
  dof: boolean;
  /** Reflection texture size (0 = a plain dark floor). */
  reflect: number;
  shadows: boolean;
  phone: boolean;
}

const isPhone = () =>
  typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

export function budgetFor(q: Quality): Budget {
  const phone = isPhone();
  const level = Math.min(3, q + (phone ? 1 : 0));
  return {
    level,
    particles: [40000, 24000, 12000, 6000][level]!,
    post: level < 3,
    bloomScale: level <= 0 ? 1 : 0.5,
    dof: level === 0,
    reflect: [512, 384, 0, 0][level]!,
    shadows: level <= 1,
    phone,
  };
}

/** The current budget; re-renders when the quality ladder moves. */
export function useBudget(): Budget {
  const q = useGfx((s) => s.quality);
  return budgetFor(q);
}

export const budgetNow = () => budgetFor(gfx.quality);
