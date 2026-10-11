"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useEffect, useRef, useState } from "react";
import { Container, Label, Text } from "@/components/ui";
import { MaskHeading } from "@/components/ui/MaskHeading";
import { world } from "@/components/world/store";
import { ChapterBody, HarvestQDay } from "./ChapterBody";
import { CHAPTERS } from "./chapters";

/** The story is chapters 1..7 (chapter 0, the hero, is its own section above "Why now"). */
const FIRST = 1;
const COUNT = CHAPTERS.length - FIRST;
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The pinned scroll story. One ScrollTrigger scrubs `world.chapter`; the globe (in its own columns)
 * reads it every frame, and the step panel swaps chapters: the label first, the headline line by
 * line out of a mask, the body 120 ms later. Harvest → Q-Day (chapters 3–4) share one scrubbed
 * widget: a year counter runs 2026 → 2035, then the classical recordings decrypt.
 */
export function Story() {
  const root = useRef<HTMLElement>(null);
  const lenis = useRef<Lenis>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(FIRST);
  const [sub, setSub] = useState(0);
  const [c, setC] = useState(FIRST);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const raf = (t: number) => lenis.current?.raf(t * 1000);
    if (!reduce) {
      lenis.current = new Lenis({ lerp: 0.1 });
      lenis.current.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
    }
    const st = ScrollTrigger.create({
      trigger: root.current,
      start: "top top",
      end: "bottom bottom",
      scrub: reduce ? true : 0.6,
      onUpdate: (self) => {
        if (fill.current) fill.current.style.transform = `scaleY(${self.progress})`;
        if (!self.isActive) return;
        const v = Math.min(CHAPTERS.length - 0.001, FIRST + self.progress * COUNT);
        world.chapter = v;
        const i = Math.floor(v);
        if (world.accent !== CHAPTERS[i]!.accent) world.accent = CHAPTERS[i]!.accent;
        setActive(i);
        setSub(v - i);
        setC(v);
      },
    });
    return () => {
      st.kill();
      gsap.ticker.remove(raf);
      lenis.current?.destroy();
    };
  }, []);

  const goTo = (i: number) => {
    const el = root.current;
    if (!el) return;
    const y = el.offsetTop + ((el.offsetHeight - window.innerHeight) * (i - FIRST + 0.3)) / COUNT;
    if (lenis.current) lenis.current.scrollTo(y, { duration: 1.2 });
    else window.scrollTo({ top: y });
  };

  const ch = CHAPTERS[active]!;
  const harvestSpan = active === 2 || active === 3;
  return (
    <section
      id="story"
      ref={root}
      style={{ height: `${COUNT * 140}vh` }}
      className="relative"
      aria-label="How Q-Setu works, step by step"
    >
      <div className="sticky top-14 h-story overflow-hidden">
        {/* Progress rail: a hairline that fills as you scroll; the current index brightens. */}
        <nav
          aria-label="Story chapters"
          className="absolute left-6 top-1/2 hidden -translate-y-1/2 xl:block"
        >
          <div className="relative flex gap-3">
            <span className="relative block w-px bg-line" aria-hidden>
              <span
                ref={fill}
                className="absolute inset-0 origin-top bg-fg-2"
                style={{ transform: "scaleY(0)" }}
              />
            </span>
            <ol className="space-y-3 py-1">
              {CHAPTERS.slice(FIRST).map((cc, k) => {
                const i = k + FIRST;
                return (
                  <li key={cc.id}>
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      aria-current={i === active ? "step" : undefined}
                      aria-label={`Chapter ${pad(i + 1)}: ${cc.label}`}
                      className={`font-mono text-label transition-colors duration-300 ${i === active ? "text-fg" : i < active ? "text-fg-2" : "text-fg-3"}`}
                    >
                      {pad(i + 1)}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </nav>

        <Container className="grid h-full grid-cols-12 content-start gap-x-6 md:content-stretch">
          <div
            data-world-focus
            data-world-drag
            className="col-span-12 h-globe md:order-2 md:col-span-5 md:col-start-8 md:h-full"
            aria-hidden
          />
          <div className="col-span-12 pt-6 md:order-1 md:col-span-6 md:pt-32 lg:col-span-5">
            <div key={ch.id}>
              <div className="animate-reveal">
                <Label>
                  {pad(active + 1)} — {ch.label}
                </Label>
              </div>
              <MaskHeading text={ch.title} className="mt-4" delay={60} />
              <div className="mt-4 max-w-text animate-reveal" style={{ animationDelay: "240ms" }}>
                <Text>{ch.body}</Text>
              </div>
              {!harvestSpan && (
                <div className="mt-8 animate-reveal" style={{ animationDelay: "300ms" }}>
                  <ChapterBody index={active} sub={sub} />
                </div>
              )}
            </div>
            {/* Mounted once across both chapters, so the year counter scrubs continuously. */}
            {harvestSpan && (
              <div className="mt-8">
                <HarvestQDay progress={(c - 2) / 2} />
              </div>
            )}
          </div>
        </Container>
      </div>
    </section>
  );
}
