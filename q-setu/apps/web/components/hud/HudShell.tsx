"use client";

/**
 * The diagnostics HUD: glass panels around a live 3D stage, in CSS perspective. Desktop: the status
 * bar on top, DIAGNOSTICS on the left, TERMINAL and RISK SCORE on the right, the PIPELINE along the
 * bottom. Side panels turn 4° towards the centre, the whole HUD tilts up to 3° with the cursor, and
 * when a proof is anchored it leans back to 8° for 1.5 s, as if the camera pulled away. Phones: the
 * stage takes the top 60%, the panels become a swipeable drawer and the pipeline stays pinned.
 * Keys: ← → stages, Space autoplay, R reset. Reduced motion: no tilt.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePresent } from "@/lib/client/present";
import {
  actions,
  autoplay,
  getPipeline,
  nextStage,
  runStage,
  usePipeline,
} from "@/lib/client/pipeline";
import { sfx } from "@/lib/client/sfx";
import { Diagnostics } from "./Diagnostics";
import { PipelineStepper } from "./PipelineStepper";
import { RiskGauge } from "./RiskGauge";
import { StageFrame } from "./StageFrame";
import { Terminal } from "./Terminal";
import { TopBar } from "./TopBar";

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** → advances: look at the next stage that has run, else run the next stage. */
export function stepForward() {
  const s = getPipeline();
  const last = s.status.lastIndexOf("done");
  if (s.stage < last) actions.view(s.stage + 1);
  else {
    const n = nextStage(s);
    if (n >= 0) void runStage(n);
  }
}

/** Sounds for the real events (only when SFX is on). */
function useStageSounds() {
  const doneAt = usePipeline((s) => s.doneAt);
  const running = usePipeline((s) => s.status[4] === "running");
  const prev = useRef(doneAt);
  useEffect(() => {
    const p = prev.current;
    prev.current = doneAt;
    if (doneAt[0] && doneAt[0] !== p[0]) sfx.hum();
    if (doneAt[2] && doneAt[2] !== p[2]) sfx.shatter();
    if (doneAt[3] && doneAt[3] !== p[3]) sfx.lock();
  }, [doneAt]);
  useEffect(() => {
    if (running) sfx.sweep();
  }, [running]);
}

function DomainBox({ compact }: { compact: boolean }) {
  const domain = usePipeline((s) => s.domain);
  const cached = usePipeline((s) => s.cached);
  const busy = usePipeline((s) => s.status.includes("running"));
  const [v, setV] = useState("");
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const d = v.trim();
        if (!d) return;
        actions.setDomain(d);
        const url = new URL(location.href);
        url.searchParams.set("domain", d);
        history.replaceState(null, "", url);
        void actions.replay().then(() => autoplay());
      }}
    >
      <label htmlFor="hud-domain" className="sr-only">
        Enter any domain
      </label>
      <input
        id="hud-domain"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={domain ? `${domain}${cached ? " (cached example)" : ""}` : "Enter any domain"}
        autoComplete="off"
        inputMode="url"
        className={`h-8 min-w-0 flex-1 border border-line bg-inset px-2 font-mono text-micro text-fg placeholder:text-fg-3 focus:border-line-strong focus:outline-none ${compact ? "" : "md:w-80 md:flex-none"}`}
      />
      <button
        type="submit"
        disabled={busy}
        className="h-8 shrink-0 border border-line-strong px-3 font-mono text-micro uppercase text-fg disabled:opacity-40"
      >
        Diagnose
      </button>
    </form>
  );
}

export function HudShell({
  stage,
  compact = false,
  className = "",
}: {
  stage: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const anchoredAt = usePipeline((s) => s.doneAt[3]);
  const [lean, setLean] = useState(false);
  useStageSounds();

  // The cursor tilt (max 3°), skipped under reduced motion and on touch.
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      const ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      el.style.setProperty("--tilt-x", `${(-ny * 1.5).toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${(nx * 3).toFixed(2)}deg`);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  // Anchored: the dashboard leans back to 8° for 1.5 s, then settles.
  useEffect(() => {
    if (!anchoredAt || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setLean(true);
    const t = setTimeout(() => setLean(false), 1500);
    return () => clearTimeout(t);
  }, [anchoredAt]);

  // Keys and presenter commands.
  usePresent({
    next: stepForward,
    prev: () => actions.view(getPipeline().stage - 1),
    reset: () => void actions.replay(),
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const root = document.documentElement;
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (root.hasAttribute("data-present") || root.hasAttribute("data-tour")) return;
      if (e.key === "ArrowRight") stepForward();
      else if (e.key === "ArrowLeft") actions.view(getPipeline().stage - 1);
      else if (e.key === " ") {
        e.preventDefault();
        if (getPipeline().autoplay) actions.setAutoplay(false);
        else void autoplay();
      } else if (e.key === "r" || e.key === "R") void actions.replay();
      else return;
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const side = (deg: number) => ({
    transform: `rotateY(${deg}deg)`,
    transformStyle: "preserve-3d" as const,
  });
  return (
    <div
      className={`w-full ${className}`}
      style={{ perspective: "1600px" }}
      data-present-target
      data-hud
    >
      <div
        ref={root}
        className="flex h-full flex-col gap-2 transition-transform"
        style={{
          transform: lean
            ? "rotateX(8deg) scale(0.97)"
            : "rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))",
          transformStyle: "preserve-3d",
          transitionDuration: lean ? "600ms" : "220ms",
        }}
      >
        <TopBar compact={compact} />
        <DomainBox compact={compact} />
        {/* Desktop: three columns around the stage. */}
        <div
          className={`hidden min-h-0 flex-1 gap-2 md:grid ${compact ? "grid-cols-hud-compact" : "grid-cols-hud"}`}
        >
          <div
            className="min-h-0 overflow-y-auto"
            style={{ ...side(4), transformOrigin: "right center" }}
          >
            <Diagnostics className="h-full" />
          </div>
          <div className="relative min-h-0 border border-line" data-hud-stage>
            {stage}
            <StageFrame compact={compact} />
          </div>
          <div
            className="flex min-h-0 flex-col gap-2 overflow-y-auto"
            style={{ ...side(-4), transformOrigin: "left center" }}
          >
            <Terminal className="min-h-40 flex-1" />
            <RiskGauge className="shrink-0 overflow-hidden" />
          </div>
        </div>
        {/* Phones: the stage on top, the panels in a swipeable drawer. */}
        <div className="flex min-h-0 flex-col gap-2 md:hidden">
          <div className="relative h-hud-stage border border-line" data-hud-stage>
            {stage}
            <StageFrame compact />
          </div>
          <div
            className="flex snap-x snap-mandatory gap-2 overflow-x-auto"
            aria-label="Panels (swipe)"
          >
            <Diagnostics className="w-full shrink-0 snap-center" />
            <RiskGauge className="w-full shrink-0 snap-center" />
            <Terminal className="h-80 w-full shrink-0 snap-center" />
          </div>
        </div>
        <PipelineStepper className="sticky bottom-0 z-10 bg-base md:static md:bg-glass" />
      </div>
    </div>
  );
}
