"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Container, Label, Text } from "@/components/ui";
import { MaskHeading } from "@/components/ui/MaskHeading";
import { world } from "@/components/world/store";
import { STEPS } from "./chapters";
import { SealedCost } from "./SealedCost";

// The Q-Day widget breaks real (tiny) RSA in the browser; its code loads only when the section is near.
const HarvestQDay = dynamic(() => import("./HarvestQDay"), { ssr: false, loading: () => null });

const N = STEPS.length;

/**
 * "How it works": three pinned steps beside the globe. A native scroll listener (no scroll
 * hijacking) maps progress to a step; the director turns the globe to that step's pose. Steps 1–2
 * share one scrubbed widget: a year counter runs 2026 → 2035, then the classical recordings decrypt.
 */
export function Story() {
  const root = useRef<HTMLElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(0);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const span = el.offsetHeight - window.innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, span)));
      if (fill.current) fill.current.style.transform = `scaleX(${p})`;
      const inView = r.top < window.innerHeight && r.bottom > 0;
      if (!inView) return;
      const x = Math.min(N - 0.001, p * N);
      const step = STEPS[Math.floor(x)]!;
      world.chapter = step.chapter;
      world.accent = step.accent;
      setV(x);
    };
    const onScroll = () => (raf ||= requestAnimationFrame(update));
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setNear(true), {
      rootMargin: "100% 0px",
    });
    io.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const goTo = (i: number) => {
    const el = root.current;
    if (!el) return;
    const y = el.offsetTop + ((el.offsetHeight - window.innerHeight) * (i + 0.4)) / N;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  const active = Math.floor(v);
  const step = STEPS[active]!;
  return (
    <section
      id="how-it-works"
      ref={root}
      style={{ height: `${N * 120}vh` }}
      className="relative"
      aria-label="How it works, in three steps"
    >
      <div className="sticky top-14 h-story overflow-hidden">
        <Container className="grid h-full grid-cols-12 content-start gap-x-6 md:content-stretch">
          <div
            data-world-focus
            data-world-drag
            className="col-span-12 h-globe md:order-2 md:col-span-5 md:col-start-8 md:h-full"
            aria-hidden
          />
          <div className="col-span-12 pt-6 md:order-1 md:col-span-6 md:pt-24 lg:col-span-6">
            <Label className="block">04 — How it works</Label>
            {/* Progress: three steps, the current one bright, a hairline that fills with scroll. */}
            <nav aria-label="Steps" className="mt-6 flex items-center gap-4">
              {STEPS.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={i === active ? "step" : undefined}
                  className={`font-mono text-label uppercase transition-colors duration-300 ${i === active ? "text-fg" : i < active ? "text-fg-2" : "text-fg-3"}`}
                >
                  0{i + 1}
                </button>
              ))}
              <span className="relative block h-px flex-1 bg-line" aria-hidden>
                <span
                  ref={fill}
                  className="absolute inset-0 origin-left bg-fg-2"
                  style={{ transform: "scaleX(0)" }}
                />
              </span>
            </nav>
            <div key={step.id} className="mt-8">
              <div className="animate-reveal">
                <Label>{step.label}</Label>
              </div>
              <MaskHeading text={step.title} className="mt-4" delay={60} />
              <div className="mt-4 max-w-text animate-reveal" style={{ animationDelay: "240ms" }}>
                <Text>{step.body}</Text>
              </div>
              {active === 2 && (
                <div className="mt-8 animate-reveal" style={{ animationDelay: "300ms" }}>
                  <SealedCost />
                </div>
              )}
            </div>
            {active < 2 && near && (
              <div className="mt-8">
                <HarvestQDay progress={v / 2} />
              </div>
            )}
          </div>
        </Container>
      </div>
    </section>
  );
}
