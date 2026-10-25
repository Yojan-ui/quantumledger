"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SealedFailure, sealedClass, sealedLine, useSealed } from "@/components/trust/Sealed";
import { Heading } from "./type";

type Props = {
  text: string;
  as?: "h1" | "h2" | "h3" | "p";
  variant?: "display" | "h1" | "h2" | "h3";
  className?: string;
  /** Delay before the first line, in ms. Lines follow 80 ms apart. */
  delay?: number;
};

/**
 * A heading that reveals line by line: each rendered line rises out of its own mask. Lines are
 * measured after layout (so they match the real wrap) and re-measured on resize without replaying.
 * A sealed homepage headline (lib/trust/headlines) rises as its ciphertext, then resolves into the
 * words once the browser has verified and decrypted it (components/trust/Sealed).
 */
export function MaskHeading({ text, as = "h2", variant = "h1", className = "", delay = 0 }: Props) {
  const probe = useRef<HTMLSpanElement>(null);
  const [lines, setLines] = useState<string[] | null>(null);
  const [seen, setSeen] = useState(false);
  const played = useRef(false);
  const seal = useSealed(text, seen);

  // Reveal when the heading scrolls into view, not when it mounts.
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        setSeen(true);
        io.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    if (probe.current) io.observe(probe.current);
    return () => io.disconnect();
  }, []);

  useLayoutEffect(() => {
    played.current = false;
    const measure = () => {
      const el = probe.current;
      if (!el) return;
      const words = [...el.querySelectorAll<HTMLSpanElement>("[data-w]")];
      const out: string[] = [];
      let top = Number.NEGATIVE_INFINITY;
      for (const w of words) {
        const word = (w.textContent ?? "").trim();
        if (out.length === 0 || Math.abs(w.offsetTop - top) > 2) {
          out.push(word);
          top = w.offsetTop;
        } else out[out.length - 1] += ` ${word}`;
      }
      setLines(out);
    };
    measure();
    let width = probe.current?.offsetWidth ?? 0;
    const ro = new ResizeObserver(() => {
      const w = probe.current?.offsetWidth ?? 0;
      if (w === width) return;
      // A real resize re-wraps the lines; don't replay the reveal for it.
      width = w;
      played.current = true;
      measure();
    });
    if (probe.current) ro.observe(probe.current);
    return () => ro.disconnect();
  }, [text]);

  return (
    <Heading as={as} variant={variant} className={`relative ${className}`}>
      <span className="sr-only">{text.replace(/\u2011/g, "-")}</span>
      {/* Invisible copy used only to measure where the browser wraps. */}
      <span
        ref={probe}
        aria-hidden
        className={lines ? "pointer-events-none invisible absolute inset-x-0 top-0" : "invisible"}
      >
        {text.split(" ").map((w, i) => (
          <span key={i} data-w>
            {w}{" "}
          </span>
        ))}
      </span>
      {lines && (
        <span aria-hidden className="block">
          {lines.map((l, i) => {
            const at = lines.slice(0, i).reduce((n, x) => n + x.length + 1, 0);
            return (
              <span key={`${l}-${i}`} className="-mb-1 block overflow-hidden pb-1">
                <span
                  className={`block ${played.current ? "" : seen ? "animate-mask-up" : "translate-y-full"}`}
                  style={{ animationDelay: `${delay + i * 80}ms` }}
                >
                  <span className={`block ${sealedClass(seal)}`}>
                    {sealedLine(l, at, text.length, seal)}
                  </span>
                </span>
              </span>
            );
          })}
        </span>
      )}
      <SealedFailure v={seal} />
    </Heading>
  );
}
