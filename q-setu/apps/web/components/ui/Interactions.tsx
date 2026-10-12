"use client";

import { useEffect } from "react";
import { startScroll } from "@/lib/client/scroll";

/** Magnetic pull: primary buttons (data-shimmer) up to 6px, everything else 4px. */
const PULL_PRIMARY = 6;
const PULL = 4;
const MAX_TILT = 6;
/** The site's spring: stiffness 400, damping 30, mass 1 (also sampled into --ease-spring). */
const K = 400;
const C = 30;

interface Tilt {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
}

/**
 * Site-wide micro-interactions by event delegation, so primitives stay server components:
 *  - [data-spotlight]: sets --mx/--my for the panel's cursor spotlight
 *  - [data-magnetic]: pulls the element towards the cursor while hovered (primary 6px, others 4px)
 *  - [data-shimmer]: adds .shimmer once, the first time the element scrolls into view
 *  - [data-tilt]: tilts up to 6° towards the cursor on a spring (stiffness 400, damping 30), with
 *    the spotlight sheen following the cursor
 *  - buttons and [data-magnetic]: press to 0.97 with a ripple in the role colour (data-ripple)
 * Reduced motion: magnetic pull, tilt, ripple and shimmer are off; the spotlight and the press
 * scale stay (no travel involved).
 */
export function Interactions() {
  // Lenis + ScrollTrigger on GSAP's ticker: the site's one scroll clock (lib/client/scroll).
  useEffect(() => startScroll(), []);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let pulled: HTMLElement | null = null;
    const release = () => {
      if (pulled) pulled.style.transform = "";
      pulled = null;
    };
    // Tilt: each card springs towards its target angle; the loop runs only while something moves.
    const tilts = new Map<HTMLElement, Tilt>();
    let hovered: HTMLElement | null = null;
    let raf = 0;
    let last = 0;
    const step = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
      last = now;
      let moving = false;
      tilts.forEach((s, el) => {
        for (const [p, v, t] of [
          ["x", "vx", "tx"],
          ["y", "vy", "ty"],
        ] as const) {
          const a = -K * (s[p] - s[t]) - C * s[v];
          s[v] += a * dt;
          s[p] += s[v] * dt;
        }
        const still =
          Math.abs(s.x - s.tx) < 0.01 &&
          Math.abs(s.y - s.ty) < 0.01 &&
          Math.abs(s.vx) + Math.abs(s.vy) < 0.05;
        if (still && s.tx === 0 && s.ty === 0) {
          el.style.transform = "";
          tilts.delete(el);
          return;
        }
        moving ||= !still;
        el.style.transform = `perspective(900px) rotateX(${s.x.toFixed(2)}deg) rotateY(${s.y.toFixed(2)}deg)`;
      });
      raf = moving || tilts.size ? requestAnimationFrame(step) : 0;
    };
    const kick = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    };
    const untilt = () => {
      if (hovered) {
        const s = tilts.get(hovered);
        if (s) s.tx = s.ty = 0;
        hovered = null;
        kick();
      }
    };

    const move = (e: PointerEvent) => {
      const t = e.target as Element | null;
      const card =
        reduce || e.pointerType !== "mouse" ? null : t?.closest?.<HTMLElement>("[data-tilt]");
      if (card !== hovered) untilt();
      if (card) {
        hovered = card;
        const r = card.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        const s = tilts.get(card) ?? { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
        s.tx = -ny * 2 * MAX_TILT;
        s.ty = nx * 2 * MAX_TILT;
        tilts.set(card, s);
        kick();
      }
      const panel = t?.closest?.<HTMLElement>("[data-spotlight], [data-tilt]");
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
      const max = mag.hasAttribute("data-shimmer") ? PULL_PRIMARY : PULL;
      const dx = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * max;
      const dy = ((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * max;
      const c = (v: number) => Math.max(-max, Math.min(max, v));
      mag.style.transform = `translate(${c(dx).toFixed(1)}px, ${c(dy).toFixed(1)}px)`;
    };
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", release);
    document.addEventListener("pointerleave", untilt);

    // Press: scale to 0.97 and a ripple from the pointer, in the button's role colour.
    let pressed: HTMLElement | null = null;
    const down = (e: PointerEvent) => {
      const b = (e.target as Element | null)?.closest?.<HTMLElement>("button, [data-magnetic]");
      if (!b || (b as HTMLButtonElement).disabled) return;
      pressed = b;
      b.setAttribute("data-pressed", "");
      if (reduce) return;
      const r = b.getBoundingClientRect();
      const d = Math.hypot(r.width, r.height) * 2;
      const span = document.createElement("span");
      span.className = "ripple";
      span.setAttribute("aria-hidden", "true");
      const role = b.dataset.ripple;
      if (role) span.style.setProperty("--ripple", `var(--${role})`);
      Object.assign(span.style, {
        left: `${e.clientX - r.left}px`,
        top: `${e.clientY - r.top}px`,
        width: `${d}px`,
        height: `${d}px`,
      });
      if (getComputedStyle(b).position === "static") b.style.position = "relative";
      b.style.overflow = "hidden";
      b.appendChild(span);
      span.addEventListener("animationend", () => span.remove(), { once: true });
    };
    const up = () => {
      pressed?.removeAttribute("data-pressed");
      pressed = null;
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);

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
      document.removeEventListener("pointerleave", untilt);
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      cancelAnimationFrame(raf);
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
