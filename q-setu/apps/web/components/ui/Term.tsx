"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { GLOSSARY, type TermId } from "@/data/glossary";

/**
 * A glossary term: dotted underline; hover or focus shows a one-line plain explanation above it.
 * The tip is portalled to <body> (cards clip and stack their contents) and is the term's accessible
 * description, so screen readers hear it too. `termify` wraps the site's jargon inside a plain string.
 */
export function Term({
  id,
  focusable = true,
  children,
}: {
  id: TermId;
  /** False inside a button or link: the control itself takes focus (no nested tab stops). */
  focusable?: boolean;
  children: ReactNode;
}) {
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
        tabIndex={focusable ? 0 : undefined}
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

/** The jargon `termify` finds in plain strings, and the glossary entry each one opens. */
const JARGON: [RegExp, TermId][] = [
  [/\bSID\b/, "sid"],
  [/\bNODES\b/, "nodes"],
  [/\bL1\b/, "l1"],
  [/\bL3\b/, "l3"],
  [/\bL5\b/, "l5"],
  [/\bHNDL(?![a-z])/, "hndl"],
  [/Mosca(?:[’']s)?(?! &)/, "mosca"],
  [/(?<![-A-Za-z])KEM\b/, "kem"],
  [/\bCBOM\b/, "cbom"],
];

/** `text` with each piece of jargon in it wrapped in a Term. */
export function termify(text: string, focusable = true): ReactNode {
  const out: ReactNode[] = [];
  let rest = text;
  for (;;) {
    let first: { at: number; len: number; id: TermId } | undefined;
    for (const [re, id] of JARGON) {
      const m = re.exec(rest);
      if (m && (!first || m.index < first.at)) first = { at: m.index, len: m[0].length, id };
    }
    if (!first) break;
    if (first.at) out.push(rest.slice(0, first.at));
    out.push(
      <Term key={out.length} id={first.id} focusable={focusable}>
        {rest.slice(first.at, first.at + first.len)}
      </Term>,
    );
    rest = rest.slice(first.at + first.len);
  }
  if (rest) out.push(rest);
  return out.length === 1 ? out[0] : out;
}
