"use client";

/**
 * The homepage opening, full bleed. The 3D is the real diagnostics stage; over it:
 *  - the preloader line: a real ML-KEM-768 key pair generated in a worker, with its time;
 *  - the status pill (THREAT CRITICAL → MITIGATING → SECURED, from the pipeline's real results);
 *  - "cached example · scanned DATE" while the attract loop runs on the cached public example;
 *  - once the loop has played: one large "Enter any website" input that runs the pipeline for real.
 * The sequence (lib/client/hero): key pair → the particles assemble the mark → it bursts into the
 * swarm → the five real stages, compressed to ~9 s → idle drift. Reduced motion: no assembly or
 * burst; the stages run straight through to their end state (every value still real).
 */
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, useState } from "react";
import { generateVisitorKeys } from "@/components/home/visitor";
import { waitForCanvas } from "@/components/hud/DiagnosticsApp";
import { LazyView } from "@/components/scenes/LazyView";
import { ASSEMBLE_MS, BURST_MS, hero, setHero, useHero } from "@/lib/client/hero";
import {
  actions,
  ATTRACT_HOLD_MS,
  autoplay,
  EXAMPLE_DOMAIN,
  getPipeline,
  threat,
  usePipeline,
} from "@/lib/client/pipeline";

const PipelineStage = dynamic(() => import("@/components/scenes/PipelineStage"), { ssr: false });

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PILL = {
  idle: { text: "AWAITING TARGET", cls: "border-line text-fg-3" },
  critical: { text: "THREAT CRITICAL", cls: "border-danger text-danger" },
  mitigating: { text: "MITIGATING", cls: "border-warn text-warn" },
  secured: { text: "SECURED", cls: "border-ok text-ok" },
} as const;

/** Runs the opening once per page view. */
function useOpening() {
  useEffect(() => {
    let live = true;
    const s = getPipeline();
    // Navigated back with a run already on screen: no replay of the opening.
    if (s.stage >= 0 || s.autoplay) {
      setHero({ phase: "idle" });
      return;
    }
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    void (async () => {
      setHero({ phase: "keygen" });
      const keys = generateVisitorKeys().catch(() => undefined);
      await Promise.all([keys, waitForCanvas()]);
      const k = await keys;
      if (!live) return;
      setHero({ keygenMs: k?.timings.mlkem ?? 0 });
      if (!reduce) {
        setHero({ phase: "logo", assembleAt: performance.now() });
        await wait(ASSEMBLE_MS + 900);
        if (!live) return;
        setHero({ phase: "burst", burstAt: performance.now() });
        await wait(BURST_MS);
        if (!live) return;
      }
      setHero({ phase: "loop" });
      actions.setDomain("");
      try {
        await actions.detect(EXAMPLE_DOMAIN, true);
        await autoplay(reduce ? 0 : 1200, reduce ? [0, 0, 0, 0, 0] : ATTRACT_HOLD_MS);
      } catch {
        /* the input still works; the stage shows whatever ran */
      }
      if (live) setHero({ phase: "idle" });
    })();
    return () => {
      live = false;
    };
  }, []);
}

/** The headline's beat: 1 "See your quantum risk." · 2 "+ Fix it." · 3 "+ Prove it." */
export function useHeadlineBeat(): 1 | 2 | 3 {
  const phase = useHero((h) => h.phase);
  const defended = usePipeline((s) => s.status[2] === "done");
  const anchored = usePipeline((s) => s.status[3] === "done");
  const [reduce, setReduce] = useState(false);
  useEffect(() => setReduce(matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  if (reduce || phase === "idle") return 3;
  if (phase !== "loop") return 1;
  return anchored ? 3 : defended ? 2 : 1;
}

/**
 * As the hero scrolls away, its camera backs out of the sphere and the stage fades, so Join live's
 * globe (which opens close on one node) reads as the same camera continuing to pull back.
 */
function useExit(
  ref: React.RefObject<HTMLDivElement | null>,
  veil: React.RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    const el = ref.current;
    const section = el?.closest("section");
    if (!el || !section) return;
    gsap.registerPlugin(ScrollTrigger);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom top",
        onUpdate: (st) => {
          hero.exit = reduce ? 0 : st.progress;
          // The 3D draws on the shared canvas under the page, so it fades behind a page-colour veil.
          if (veil.current)
            veil.current.style.opacity = String(Math.max(0, (st.progress - 0.45) / 0.55));
        },
      });
    }, el);
    return () => ctx.revert();
  }, [ref, veil]);
}

/** The full-bleed stage behind the hero. */
export function HeroStage() {
  useOpening();
  const s = usePipeline((x) => x);
  const ref = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  useExit(ref, veil);
  return (
    <div ref={ref} className="absolute inset-0" data-hud-stage data-world-drag>
      <LazyView
        className="h-full w-full"
        label={`The diagnostics stage, full screen: ${s.domain || "the cached example"}`}
      >
        {(on) => <PipelineStage state={s} active={on} hero />}
      </LazyView>
      <div
        ref={veil}
        className="pointer-events-none absolute inset-0 bg-base opacity-0"
        aria-hidden
      />
    </div>
  );
}

/** Top-right of the hero: the preloader's real key-pair time, the cached-example label, the pill. */
export function HeroStatus() {
  const phase = useHero((h) => h.phase);
  const keygenMs = useHero((h) => h.keygenMs);
  const s = usePipeline((x) => x);
  const pill = PILL[threat(s)];
  const date = s.cached && s.scan?.scannedAt ? s.scan.scannedAt.slice(0, 10) : undefined;
  return (
    <div className="flex flex-col items-end gap-2 text-right font-mono text-micro uppercase">
      <span
        role="status"
        aria-live="polite"
        className={`border bg-base px-2 py-1 transition-colors duration-700 ${s.stage >= 0 ? pill.cls : "border-line text-fg-3"}`}
      >
        {s.stage >= 0 ? pill.text : phase === "keygen" ? "GENERATING KEYS…" : "READY"}
      </span>
      <span className="text-fg-3">
        {phase === "keygen"
          ? "ML-KEM-768 key pair · generating in this browser…"
          : keygenMs
            ? `ML-KEM-768 key pair · ${keygenMs.toFixed(2)} ms · in this browser`
            : ""}
      </span>
      {s.stage >= 0 && (
        <span className="text-fg-3">
          {s.domain || EXAMPLE_DOMAIN}
          {s.cached ? ` · cached example${date ? ` · scanned ${date}` : ""}` : " · live scan"}
        </span>
      )}
    </div>
  );
}

/** The big input that takes over once the loop has played: it runs the pipeline for real. */
export function HeroInput() {
  const phase = useHero((h) => h.phase);
  const busy = usePipeline((s) => s.status.includes("running") || s.autoplay);
  const [v, setV] = useState("");
  const ready = phase === "idle";
  return (
    <form
      className={`flex w-full max-w-text items-stretch border border-line-strong bg-base transition-opacity duration-700 ${ready ? "opacity-100" : "pointer-events-none opacity-0"}`}
      aria-hidden={!ready}
      onSubmit={(e) => {
        e.preventDefault();
        const d = v.trim();
        if (!d || busy) return;
        actions.setDomain(d);
        setHero({ phase: "loop" });
        void actions
          .replay()
          .then(() => autoplay())
          .finally(() => setHero({ phase: "idle" }));
      }}
    >
      <label htmlFor="hero-domain" className="sr-only">
        Enter any website
      </label>
      <input
        id="hero-domain"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Enter any website"
        autoComplete="off"
        inputMode="url"
        tabIndex={ready ? 0 : -1}
        className="h-14 min-w-0 flex-1 bg-transparent px-4 text-h3 text-fg placeholder:text-fg-3 focus:outline-none"
      />
      <button
        type="submit"
        disabled={busy || !v.trim()}
        tabIndex={ready ? 0 : -1}
        className="shrink-0 border-l border-line-strong px-5 font-mono text-label uppercase text-fg transition-colors duration-150 hover:bg-raised disabled:opacity-40"
      >
        {busy ? "Running…" : "Diagnose"}
      </button>
    </form>
  );
}

/** Exposed for the tour and tests: whether the opening has handed over to the input. */
export const heroReady = () => hero.phase === "idle";
