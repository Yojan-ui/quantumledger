"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Container, Label, Legend, ROLES, SectionLabel, Text, TextLink } from "@/components/ui";
import { Copy, CopyHeading } from "@/components/ui/Copy";
import { LazyView } from "@/components/scenes/LazyView";
import { world } from "@/components/world/store";
import { STEPS } from "./chapters";
import { SealedCost } from "./SealedCost";
import { scrollToY } from "@/lib/client/scroll";

// The Q-Day widget breaks real (tiny) RSA in the browser; its code loads only when the section is near.
const HarvestQDay = dynamic(() => import("./HarvestQDay"), { ssr: false, loading: () => null });
const HandshakeCubes = dynamic(() => import("@/components/scenes/HandshakeCubes"), { ssr: false });

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
  const [replayAt, setReplayAt] = useState(0);
  // Phones and reduced motion get the handshake's static end state.
  const [still, setStill] = useState(false);
  useEffect(() => {
    setStill(
      window.innerWidth < 768 || window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

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
      world.glow = step.role;
      // Quantised to 1/50 of a step: React bails out on unchanged values, so the pinned section
      // re-renders a few times per step, not on every scroll frame.
      setV(Math.min(N - 0.001, Math.round(x * 50) / 50));
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
    scrollToY(y);
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
            <SectionLabel index="04" label="How it works" role={step.role} className="" />
            {/* Progress: three steps, the current one bright, a hairline that fills with scroll. */}
            <nav aria-label="Steps" className="mt-6 flex items-center gap-4">
              {STEPS.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={i === active ? "step" : undefined}
                  className={`flex items-center gap-2 font-mono text-label uppercase transition-colors duration-300 ${i === active ? "text-fg" : i < active ? "text-fg-2" : "text-fg-3"}`}
                >
                  {/* Each tick takes its step's role colour: saffron while harvestable, KEM once sealed. */}
                  <span
                    aria-hidden
                    className={`block h-dot w-dot rounded-full transition-opacity duration-300 ${ROLES[s.role].bg} ${i === active ? "opacity-100" : "opacity-40"}`}
                  />
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
              <CopyHeading simple={step.simpleTitle} technical={step.title} className="mt-4" />
              <div className="mt-4 max-w-text animate-reveal" style={{ animationDelay: "240ms" }}>
                <Text>
                  <Copy simple={step.simpleBody} technical={step.body} />
                </Text>
                <TextLink href="/demo/how-it-works" className="mt-4 inline-block">
                  Watch the handshake, step by step →
                </TextLink>
              </div>
              {active === 2 && (
                <div className="mt-6 animate-reveal space-y-6" style={{ animationDelay: "300ms" }}>
                  <button
                    type="button"
                    onClick={() => setReplayAt(performance.now())}
                    className="block w-full max-w-text text-left"
                    aria-label="Replay the handshake"
                  >
                    <LazyView
                      className="h-40 w-full"
                      label="Client and server lattice cubes: the client sends an ML-KEM packet, the server answers with an ML-DSA signature, and the cubes interlock when the shared key is derived."
                    >
                      {(on) => (
                        <HandshakeCubes
                          progress={still ? 1 : Math.min(1, Math.max(0, (v - 2) / 0.75))}
                          replayAt={still ? 0 : replayAt}
                          active={on}
                        />
                      )}
                    </LazyView>
                  </button>
                  <Legend roles={["kem", "sig", "ok"]} />
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
