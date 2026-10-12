"use client";

/**
 * The one-click judge tour ("Take the 3-minute tour", or ?tour=1). It drives the real site, in
 * order: hero (and the four-step analogy) → a phone joins → the Readiness Index → the Q-Day film → the deploy film → the ledger
 * tamper film → the impact calculator → the call to action. Each demo step starts that film's
 * autoplay and moves on when the film reaches its last shot (or a time limit). → skips a step,
 * Esc ends the tour. Everything it shows is local: the room, the cached index and the demos all
 * work offline. Mounted in the root layout, so it survives page changes.
 */
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { sendPresent } from "@/lib/client/present";
import { onRoom } from "@/lib/client/room";
import { pct, READINESS, share } from "@/lib/readiness";

const RoomPanel = dynamic(() => import("@/components/room/RoomPanel").then((m) => m.RoomPanel), {
  ssr: false,
});

const KEY = "qsetu:tour";
const START = "qsetu:tour-start";

/** Starts the tour from anywhere (the hero button). */
export const startTour = () => window.dispatchEvent(new Event(START));

interface Ctx {
  signal: AbortSignal;
  go: (path: string, anchor?: string) => Promise<void>;
  wait: (ms: number) => Promise<void>;
  until: (ok: () => boolean, maxMs: number) => Promise<boolean>;
  film: (lastShot: string, maxMs: number) => Promise<void>;
  setQr: (on: boolean) => void;
  /** Messages the room has opened since the tour started (from the room's own events). */
  sealed: () => number;
}

interface TourStep {
  id: string;
  title: string;
  caption: string;
  /** Expected length, for the progress bar. */
  ms: number;
  run: (c: Ctx) => Promise<void>;
}

/** Sets a React-controlled input's value as if typed. */
function typeInto(el: HTMLInputElement | null, value: string) {
  if (!el) return;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const STEPS: TourStep[] = [
  {
    id: "hero",
    title: "Q-Setu",
    caption: "Q-Setu puts quantum-safe locks on any system in India, in one line.",
    ms: 13000,
    run: async (c) => {
      await c.go("/", "top");
      await c.wait(4000);
      // Then the four-step analogy: the explanation a non-specialist needs before the demos.
      await c.go("/", "analogy");
      await c.wait(8000);
    },
  },
  {
    id: "phone",
    title: "Join from your phone",
    caption: "Scan the code and seal a message on your phone. We'll wait for the first one.",
    ms: 20000,
    run: async (c) => {
      // Count from the start of the step: a quick phone can seal before the page has scrolled.
      const before = c.sealed();
      await c.go("/", "top");
      c.setQr(true);
      const arrived = await c.until(() => c.sealed() > before, 20000);
      if (arrived) await c.wait(3500);
      c.setQr(false);
    },
  },
  {
    id: "index",
    title: "India Quantum Readiness Index",
    caption: `Of ${READINESS.all.reachable} public Indian sites we reached, ${pct(share(READINESS.all, "hybridPq"))} already use a quantum-safe lock.`,
    ms: 15000,
    run: async (c) => {
      await c.go("/", "index");
      await c.wait(6000);
      document.querySelectorAll<HTMLButtonElement>("#index [aria-pressed]")[2]?.click();
      await c.wait(5000);
      document.querySelectorAll<HTMLButtonElement>("#index [aria-pressed]")[0]?.click();
      await c.wait(4000);
    },
  },
  {
    id: "qday",
    title: "Q-Day",
    caption: "Recorded today, opened at Q-Day. Unless it was sealed with Q-Setu.",
    ms: 28000,
    run: async (c) => {
      await c.go("/demo/qday");
      await c.film("aftermath", 40000);
    },
  },
  {
    id: "deploy",
    title: "Deploy anywhere",
    caption: "One adapter per system. Watch a whole sector switch to quantum-safe.",
    ms: 28000,
    run: async (c) => {
      await c.go("/demo/deploy");
      await c.film("all", 45000);
    },
  },
  {
    id: "ledger",
    title: "Tamper-proof record",
    caption: "Someone edits one entry in the database. The signed chain catches it at once.",
    ms: 28000,
    run: async (c) => {
      await c.go("/demo/ledger");
      await c.film("restore", 45000);
    },
  },
  {
    id: "impact",
    title: "Impact",
    caption: "How long must records stay secret? Longer than today's locks will last.",
    ms: 12000,
    run: async (c) => {
      await c.go("/", "impact");
      const years = document.querySelector<HTMLInputElement>(
        '#impact input[type="number"][max="100"]',
      );
      await c.wait(3000);
      for (const y of ["10", "30", "50"]) {
        typeInto(years, y);
        await c.wait(3000);
      }
    },
  },
  {
    id: "cta",
    title: "Pilot partners",
    caption: "Banks, hospitals, universities and departments: pilot Q-Setu with us.",
    ms: 8000,
    run: async (c) => {
      await c.go("/", "early-access");
      await c.wait(8000);
    },
  },
];

class Skipped extends Error {}

export function Tour() {
  const router = useRouter();
  const path = usePathname();
  const pathRef = useRef(path);
  pathRef.current = path;
  const [step, setStep] = useState(-1);
  const [qr, setQr] = useState(false);
  const [stepStart, setStepStart] = useState(0);
  const [now, setNow] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const running = useRef(false);
  const sealed = useRef(0);

  const stop = useCallback(() => {
    abort.current?.abort();
    running.current = false;
    sessionStorage.removeItem(KEY);
    document.documentElement.removeAttribute("data-tour");
    setStep(-1);
    setQr(false);
  }, []);

  const run = useCallback(
    async (from: number) => {
      if (running.current) return;
      running.current = true;
      document.documentElement.setAttribute("data-tour", "");
      for (let i = from; i < STEPS.length && running.current; i++) {
        sessionStorage.setItem(KEY, String(i));
        setStep(i);
        setStepStart(performance.now());
        const ac = new AbortController();
        abort.current = ac;
        const signal = ac.signal;
        const check = () => {
          if (signal.aborted) throw new Skipped();
        };
        const wait = (ms: number) =>
          new Promise<void>((res, rej) => {
            const t = setTimeout(res, ms);
            signal.addEventListener("abort", () => (clearTimeout(t), rej(new Skipped())), {
              once: true,
            });
          });
        const until = async (ok: () => boolean, maxMs: number) => {
          const end = performance.now() + maxMs;
          while (performance.now() < end) {
            check();
            if (ok()) return true;
            await wait(200);
          }
          return false;
        };
        const ctx: Ctx = {
          signal,
          wait,
          until,
          setQr,
          sealed: () => sealed.current,
          go: async (to, anchor) => {
            const moved = pathRef.current !== to;
            if (moved) {
              router.push(to);
              await until(() => pathRef.current === to, 15000);
              await wait(600);
            }
            // Navigation leaves focus on the skip link; the tour isn't keyboard navigation.
            (document.activeElement as HTMLElement | null)?.blur?.();
            if (anchor) {
              await until(() => !!document.getElementById(anchor), 10000);
              // Jump on a fresh page (no long scroll across every section); glide within one.
              document
                .getElementById(anchor)
                ?.scrollIntoView({ behavior: moved ? "instant" : "smooth", block: "start" });
              await wait(moved ? 400 : 900);
            } else if (moved) window.scrollTo({ top: 0, behavior: "instant" });
          },
          film: async (last, maxMs) => {
            const hud = () =>
              document.querySelector<HTMLElement>("[data-present-target][data-shot]");
            await until(() => !!hud(), 15000);
            // Bring the film's stage on screen (on a phone it sits below the controls).
            hud()?.parentElement?.scrollIntoView({ behavior: "smooth", block: "center" });
            await wait(800);
            sendPresent("play");
            const end = performance.now() + maxMs;
            await until(() => {
              const h = hud();
              if (
                h?.dataset.playing === "false" &&
                h.dataset.shot !== last &&
                performance.now() < end - 2000
              )
                sendPresent("play");
              return h?.dataset.shot === last && h.dataset.settled === "true";
            }, maxMs);
            await wait(2500);
          },
        };
        try {
          await STEPS[i]!.run(ctx);
        } catch (e) {
          if (!(e instanceof Skipped)) console.warn("tour step failed", e);
        }
        setQr(false);
      }
      if (running.current) stop();
    },
    [router, stop],
  );

  // Start: the hero button, or ?tour=1. A reload mid-tour resumes at the same step.
  useEffect(() => {
    const begin = () => {
      abort.current?.abort();
      running.current = false;
      void run(0);
    };
    window.addEventListener(START, begin);
    const q = new URLSearchParams(location.search).get("tour");
    const saved = sessionStorage.getItem(KEY);
    if (q === "1") void run(0);
    else if (saved !== null) void run(Number(saved) || 0);
    return () => window.removeEventListener(START, begin);
  }, [run]);

  // While the tour runs, count the room's opened messages (the join step waits for one).
  const on = step >= 0;
  useEffect(() => {
    if (!on) return;
    return onRoom((e) => {
      if (e.kind === "sealed") sealed.current++;
    });
  }, [on]);

  // → skips to the next step; Esc ends the tour.
  useEffect(() => {
    if (step < 0) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopImmediatePropagation();
        abort.current?.abort();
      } else if (e.key === "Escape") {
        e.stopImmediatePropagation();
        stop();
      }
    };
    window.addEventListener("keydown", key, { capture: true });
    return () => window.removeEventListener("keydown", key, { capture: true });
  }, [step, stop]);

  // Progress inside the current step.
  useEffect(() => {
    if (step < 0) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [step]);

  if (step < 0) return null;
  const s = STEPS[step]!;
  const within = Math.min(1, (now - stepStart) / s.ms);
  return (
    <>
      {qr && <RoomPanel onClose={() => abort.current?.abort()} />}
      <div
        role="region"
        aria-label="Guided tour"
        data-tour-bar
        data-tour-step={s.id}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-line-strong bg-base"
      >
        <div className="flex gap-1 px-4 pt-3 md:px-6" aria-hidden>
          {STEPS.map((x, i) => (
            <span key={x.id} className="relative h-1 flex-1 overflow-hidden rounded-full bg-raised">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-kem"
                style={{ width: `${i < step ? 100 : i === step ? within * 100 : 0}%` }}
              />
            </span>
          ))}
        </div>
        <div className="flex items-center gap-4 px-4 py-3 md:px-6">
          <span className="hidden shrink-0 font-mono text-label uppercase text-fg-3 md:block">
            {step + 1}/{STEPS.length} · {s.title}
          </span>
          <p
            key={s.id}
            className="min-w-0 flex-1 animate-tick-in text-small text-fg md:text-body"
            aria-live="polite"
            data-tour-caption
          >
            {s.caption}
          </p>
          <button
            type="button"
            onClick={() => abort.current?.abort()}
            className="shrink-0 font-mono text-label uppercase text-fg-2 hover:text-fg"
          >
            Skip →
          </button>
          <button
            type="button"
            onClick={stop}
            className="shrink-0 font-mono text-label uppercase text-fg-3 hover:text-fg"
          >
            End · Esc
          </button>
        </div>
      </div>
    </>
  );
}
