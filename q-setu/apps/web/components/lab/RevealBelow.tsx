"use client";

import gsap from "gsap";
import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "@/lib/client/motion";

/**
 * Short GSAP reveals for a page's sections: children below the fold fade up as they scroll in.
 * Children already on screen are never hidden, so nothing waits for JavaScript to be read.
 */
export function RevealBelow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const root = ref.current;
    if (!root || reduce) return;
    const below = [...root.children].filter(
      (el) => el.getBoundingClientRect().top > window.innerHeight,
    ) as HTMLElement[];
    if (!below.length) return;
    gsap.set(below, { opacity: 0, y: 14 });
    const io = new IntersectionObserver(
      (entries) => {
        const shown = entries.filter((e) => e.isIntersecting).map((e) => e.target);
        if (!shown.length) return;
        shown.forEach((el) => io.unobserve(el));
        gsap.to(shown, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.08 });
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    below.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      gsap.set(below, { clearProps: "opacity,transform" });
    };
  }, [reduce]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
