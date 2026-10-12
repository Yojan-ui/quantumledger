"use client";

/**
 * A short celebration when a visitor completes something (a scan, a seal, a deploy): 48 particles in
 * --ok fly out of the element and fade, once, in under 600 ms. One fixed canvas, removed when done.
 * Skipped entirely under reduced motion.
 */
import { token } from "@/lib/tokens";

const N = 48;
const LIFE_MS = 560;

export function burst(
  from: Element | { x: number; y: number },
  role: "--ok" | "--kem" | "--sig" = "--ok",
) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r =
    "getBoundingClientRect" in from
      ? from.getBoundingClientRect()
      : { left: from.x, top: from.y, width: 0, height: 0 };
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = 320;
  const c = document.createElement("canvas");
  c.setAttribute("aria-hidden", "true");
  c.width = c.height = size * dpr;
  Object.assign(c.style, {
    position: "fixed",
    left: `${cx - size / 2}px`,
    top: `${cy - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    pointerEvents: "none",
    zIndex: "60",
  });
  document.body.appendChild(c);
  const ctx = c.getContext("2d");
  if (!ctx) return c.remove();
  ctx.scale(dpr, dpr);
  ctx.fillStyle = token(role);
  const ps = Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2 + Math.random() * 0.4;
    const v = 70 + Math.random() * 110;
    return { a, v, s: 1.5 + Math.random() * 2 };
  });
  const t0 = performance.now();
  const frame = (now: number) => {
    const t = (now - t0) / LIFE_MS;
    ctx.clearRect(0, 0, size, size);
    if (t >= 1) return c.remove();
    // Ease-out travel; a slight fall; fade over the second half.
    const k = 1 - (1 - t) ** 3;
    ctx.globalAlpha = t < 0.5 ? 1 : 1 - (t - 0.5) * 2;
    for (const p of ps) {
      const d = p.v * k;
      ctx.beginPath();
      ctx.arc(
        size / 2 + Math.cos(p.a) * d,
        size / 2 + Math.sin(p.a) * d + 24 * t * t,
        p.s * (1 - t * 0.5),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
