"use client";

import { useEffect } from "react";

const MAX_PULL = 4;

/**
 * Site-wide micro-interactions by event delegation, so primitives stay server components:
 *  - [data-spotlight]: sets --mx/--my for the panel's cursor spotlight
 *  - [data-magnetic]: pulls the element up to 4px towards the cursor while hovered
 *  - [data-shimmer]: adds .shimmer once, the first time the element scrolls into view
 * Reduced motion: magnetic pull and shimmer are off; the spotlight is static (no motion involved).
 */
export function Interactions() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let pulled: HTMLElement | null = null;
    const release = () => {
      if (pulled) pulled.style.transform = "";
      pulled = null;
    };
    const move = (e: PointerEvent) => {
      const t = e.target as Element | null;
      const panel = t?.closest?.<HTMLElement>("[data-spotlight]");
      if (panel) {
        const r = panel.getBoundingClientRect();
        panel.style.setProperty("--mx", `${e.clientX - r.left}px`);
        panel.style.setProperty("--my", `${e.clientY - r.top}px`);
      }
      if (reduce) return;
      const mag = t?.closest?.<HTMLElement>("[data-magnetic]");
      if (mag !== pulled) release();
      if (!mag || (mag as HTMLButtonElement).disabled) return;
      pulled = mag;
      const r = mag.getBoundingClientRect();
      const dx = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * MAX_PULL;
      const dy = ((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * MAX_PULL;
      const c = (v: number) => Math.max(-MAX_PULL, Math.min(MAX_PULL, v));
      mag.style.transform = `translate(${c(dx).toFixed(1)}px, ${c(dy).toFixed(1)}px)`;
    };
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", release);

    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          en.target.classList.add("shimmer");
        }),
      { threshold: 0.8 },
    );
    const scan = () =>
      document.querySelectorAll("[data-shimmer]").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        if (!reduce) io.observe(el);
      });
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", release);
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
