"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/client/motion";
import type { StoryStep } from "@/lib/lab/words";

/**
 * The attack as a short numbered story. Lines below the fold fade up as they scroll in (a short
 * GSAP reveal); lines already on screen are never hidden, so nothing flashes on load.
 */
export function IncidentStory({ steps }: { steps: StoryStep[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const list = ref.current;
    if (!list || reduce) return;
    const below = [...list.children].filter(
      (el) => el.getBoundingClientRect().top > window.innerHeight,
    ) as HTMLElement[];
    if (!below.length) return;
    gsap.set(below, { opacity: 0, y: 12 });
    const io = new IntersectionObserver(
      (entries) => {
        const shown = entries.filter((e) => e.isIntersecting).map((e) => e.target);
        if (!shown.length) return;
        shown.forEach((el) => io.unobserve(el));
        gsap.to(shown, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out", stagger: 0.06 });
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    below.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      gsap.set(below, { clearProps: "opacity,transform" });
    };
  }, [steps, reduce]);
  return (
    <ol ref={ref} className="flex flex-col gap-4">
      {steps.map((s, i) => (
        <li key={`${s.from}-${s.to}`} className="grid grid-cols-entry gap-4">
          <span className="tabular font-mono text-small text-fg-3">
            {s.from === s.to ? `Step ${s.from}` : `Steps ${s.from}–${s.to}`}
          </span>
          <p className="flex gap-3 text-body text-fg-2">
            <span
              aria-hidden
              className={`mt-3 block h-dot w-dot shrink-0 rounded-full ${s.outcome === "stopped" ? "bg-ok" : "bg-fg-3"}`}
            />
            <span>
              <span className="sr-only">{i + 1}. </span>
              {s.text}
            </span>
          </p>
        </li>
      ))}
    </ol>
  );
}
