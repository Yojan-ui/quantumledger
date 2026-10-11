"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Fades content in once (opacity 0→1, translateY 12px→0, 700ms) when it enters the viewport. */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => e?.isIntersecting && (setOn(true), io.disconnect()),
      { rootMargin: "0px 0px -10% 0px" },
    );
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`${on ? "animate-reveal" : "opacity-0"} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
