"use client";

/**
 * The homepage camera flight: each section with a globe shot owns a range of `world.journey` (the
 * shot list in components/world/director.ts) and scrubs through it as it crosses the middle of the
 * screen, on the shared GSAP/Lenis clock. Reduced motion: no flight; the section's opening shot is
 * held (the camera cuts there).
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, type RefObject } from "react";
import { world } from "@/components/world/store";

export function useJourney(
  ref: RefObject<HTMLElement | null>,
  from: number,
  to: number,
  /** Also called with the section's progress (0..1), e.g. to scrub a chapter's effect. */
  onProgress?: (p: number) => void,
) {
  // `from` < 0: not on the flight (the same component on another page).
  useEffect(() => {
    const el = ref.current;
    if (!el || from < 0) return;
    gsap.registerPlugin(ScrollTrigger);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: el,
        start: "top center",
        end: "bottom center",
        onUpdate: (st) => {
          world.journey = reduce ? from : from + (to - from) * st.progress;
          onProgress?.(st.progress);
        },
        onToggle: (st) => {
          if (!st.isActive) return;
          world.journey = reduce ? from : from + (to - from) * st.progress;
          onProgress?.(st.progress);
        },
      });
    }, el);
    return () => ctx.revert();
    // `onProgress` is expected to be stable for the section's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, from, to]);
}
