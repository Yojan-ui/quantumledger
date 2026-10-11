"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Code block: inset background, 1px border, 14px mono, copy button on the right. A plain snippet
 * (no `children`) types itself out at 12 ms per character the first time it scrolls into view; the
 * untyped rest is laid out invisibly, so nothing shifts. Reduced motion: shown in full.
 */
export function Code({
  code,
  children,
  className = "",
  copy = true,
  wrap = false,
  type = true,
}: {
  code: string;
  children?: ReactNode;
  className?: string;
  copy?: boolean;
  wrap?: boolean | "words";
  type?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const typed = type && children === undefined;
  const [n, setN] = useState(typed ? 0 : code.length);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!typed) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(code.length);
      return;
    }
    setN(0);
    let timer: ReturnType<typeof setInterval> | undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        timer = setInterval(
          () =>
            setN((x) => {
              if (x + 1 >= code.length) clearInterval(timer);
              return x + 1;
            }),
          12,
        );
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    if (ref.current) io.observe(ref.current);
    return () => {
      io.disconnect();
      clearInterval(timer);
    };
  }, [typed, code]);

  return (
    <div
      ref={ref}
      className={`flex items-start rounded-sm border border-line bg-inset ${className}`}
    >
      <pre
        className={`min-w-0 flex-1 overflow-x-auto px-4 py-3 font-mono text-small text-fg ${wrap === "words" ? "whitespace-pre-wrap break-words" : wrap ? "whitespace-pre-wrap break-all" : ""}`}
      >
        <code>
          {typed ? (
            <>
              <span className="sr-only">{code}</span>
              <span aria-hidden>{code.slice(0, n)}</span>
              <span aria-hidden className="invisible">
                {code.slice(n)}
              </span>
            </>
          ) : (
            (children ?? code)
          )}
        </code>
      </pre>
      {copy && (
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard?.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            })
          }
          className="grid shrink-0 px-3 py-3 font-mono text-label uppercase text-fg-3 transition-colors duration-150 hover:text-fg"
          aria-label="Copy code"
        >
          {/* Both labels share one grid cell, so the button width never changes as it morphs. */}
          <span
            aria-hidden
            className={`col-start-1 row-start-1 transition duration-150 ${copied ? "-translate-y-1 opacity-0" : "opacity-100"}`}
          >
            Copy
          </span>
          <span
            aria-hidden
            className={`col-start-1 row-start-1 text-fg transition duration-150 ${copied ? "opacity-100" : "translate-y-1 opacity-0"}`}
          >
            Copied <span className="text-accent">✓</span>
          </span>
          <span className="sr-only" aria-live="polite">
            {copied ? "Copied" : ""}
          </span>
        </button>
      )}
    </div>
  );
}

export const Accent = ({ children }: { children: ReactNode }) => (
  <span className="text-accent">{children}</span>
);
export const Muted = ({ children }: { children: ReactNode }) => (
  <span className="text-fg-2">{children}</span>
);
