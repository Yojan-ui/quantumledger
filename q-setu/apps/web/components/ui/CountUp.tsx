"use client";

import { useEffect, useRef, useState } from "react";
import { easeToken } from "@/lib/ease";

/**
 * Counts from 0 to `to` the first time it scrolls into view (900 ms, motion token easing), with
 * tabular numerals. If `to` changes later it rolls from the current value. Reduced motion: no tween.
 */
export function CountUp({
  to,
  format,
  className = "",
  ms = 900,
}: {
  to: number;
  format: (n: number) => string;
  className?: string;
  ms?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  const [seen, setSeen] = useState(false);
  const cur = useRef(0);

  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => e?.isIntersecting && (setSeen(true), io.disconnect()),
    );
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!seen || !Number.isFinite(to)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cur.current = to;
      setN(to);
      return;
    }
    const from = cur.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      cur.current = from + (to - from) * easeToken(k);
      setN(cur.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seen, to, ms]);

  return (
    <span ref={ref} className={`tabular ${className}`}>
      {format(n)}
    </span>
  );
}
