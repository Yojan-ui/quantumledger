"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const GLYPHS = "0123456789abcdef";

/**
 * Morphs from one string to another. Characters resolve left to right through random hex
 * glyphs, so ciphertext appears to "decrypt" into plaintext.
 */
export function ScrambleText({
  text,
  duration = 900,
  className,
}: {
  text: string;
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(text);
  const prev = useRef(text);

  useEffect(() => {
    const from = prev.current;
    prev.current = text;
    if (reduce || from === text) {
      setShown(text);
      return;
    }
    const len = Math.max(from.length, text.length);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const resolved = Math.floor(t * len);
      let out = "";
      for (let i = 0; i < len; i++) {
        if (i < resolved) out += text[i] ?? "";
        else if (i < resolved + 6) out += GLYPHS[(Math.random() * 16) | 0];
        else out += from[i] ?? "";
      }
      setShown(out);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, duration, reduce]);

  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>{shown}</span>
    </span>
  );
}
