"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { GLOSSARY, type TermId } from "@/data/glossary";

/**
 * A glossary term: dotted underline; hover or focus shows a one-line plain explanation above it.
 * The tip is portalled to <body> (cards clip and stack their contents) and is the term's accessible
 * description, so screen readers hear it too.
 */
export function Term({ id, children }: { id: TermId; children: ReactNode }) {
  const tip = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  // The portal mounts after hydration (the server has no <body> to portal into).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setAt({ x: Math.min(r.left, window.innerWidth - 336), y: r.top });
  };
  const hide = () => setAt(null);
  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        aria-describedby={tip}
        onPointerEnter={show}
        onPointerLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="cursor-help underline decoration-fg-3 decoration-dotted underline-offset-4"
        data-term={id}
      >
        {children}
      </span>
      {mounted &&
        createPortal(
          <span
            id={tip}
            role="tooltip"
            className={`pointer-events-none fixed z-50 w-max max-w-label -translate-y-full rounded-sm border border-line-strong bg-raised px-3 py-2 text-small text-fg-2 transition-opacity duration-150 ${at ? "opacity-100" : "opacity-0"}`}
            style={at ? { left: at.x, top: at.y - 8 } : { left: -9999, top: 0 }}
          >
            {GLOSSARY[id]}
          </span>,
          document.body,
        )}
    </>
  );
}
