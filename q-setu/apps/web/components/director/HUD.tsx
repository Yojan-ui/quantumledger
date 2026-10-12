"use client";

import { useEffect } from "react";
import { ROLES } from "@/components/ui/Role";
import { usePresent } from "@/lib/client/present";
import { Copy } from "@/components/ui/Copy";
import type { Director } from "./useDirector";
import type { Step } from "./types";

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);

/**
 * The director's HUD: one-line caption (masked reveal), a step bar with the current step in its role
 * colour, Prev / Next, Autoplay and Replay. Keys: ← → step, Space autoplay, R replay (in presenter
 * mode the presenter owns the keys and forwards ←/→/R here).
 */
export function DirectorHUD({
  director,
  steps,
  playing,
  onToggle,
  onNext,
  onPrev,
  onReplay,
  busy = false,
}: {
  director: Director;
  steps: Step[];
  playing: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onReplay: () => void;
  busy?: boolean;
}) {
  const { shot, index } = director.state;
  const step = shot.step ?? -1;

  usePresent({
    next: onNext,
    prev: onPrev,
    reset: onReplay,
    play: () => {
      if (!playing) onToggle();
    },
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      // In presenter mode or the judge tour, the page-level controller owns the keys.
      const root = document.documentElement;
      if (root.hasAttribute("data-present") || root.hasAttribute("data-tour") || typing(e.target))
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") onNext();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === " ") {
        e.preventDefault();
        onToggle();
      } else if (e.key === "r" || e.key === "R") onReplay();
      else return;
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onNext, onPrev, onToggle, onReplay]);

  return (
    <div
      data-present-target
      data-shot={shot.id}
      data-settled={director.state.settled}
      data-playing={playing}
      className="pointer-events-none absolute inset-x-0 bottom-0 p-4 md:p-6"
    >
      {/* Caption: one line, revealed through a mask on every shot change. */}
      <p className="overflow-hidden pb-1 text-h3 font-medium text-fg" aria-live="polite">
        <span key={`${index}-${director.state.take}`} className="block animate-mask-up">
          <Copy simple={shot.simple ?? shot.caption} technical={shot.caption} />
        </span>
      </p>
      <div className="pointer-events-auto mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <ol className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-2 font-mono text-label uppercase">
          {steps.map((s, i) => (
            <li
              key={s.label}
              className={`flex items-center gap-2 transition-colors duration-300 ${i === step ? "text-fg" : i < step ? "text-fg-2" : "text-fg-3"}`}
            >
              <span
                aria-hidden
                className={`block h-1 w-6 rounded-full transition-opacity duration-300 ${ROLES[s.role].bg} ${i === step ? "opacity-100" : i < step ? "opacity-40" : "opacity-10"}`}
              />
              {String(i + 1).padStart(2, "0")} {s.label}
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-2" role="group" aria-label="Shot controls">
          <HudButton onClick={onPrev} disabled={busy}>
            ← Prev
          </HudButton>
          <HudButton onClick={onNext} disabled={busy}>
            Next →
          </HudButton>
          <HudButton onClick={onToggle} pressed={playing}>
            {playing ? "Pause" : "Play"}
          </HudButton>
          <HudButton onClick={onReplay}>Replay</HudButton>
        </div>
      </div>
    </div>
  );
}

function HudButton({
  children,
  onClick,
  disabled,
  pressed,
}: {
  children: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className={`h-8 rounded-sm border px-3 font-mono text-label uppercase transition-colors duration-150 disabled:opacity-40 ${pressed ? "border-line-strong bg-raised text-fg" : "border-line bg-base text-fg-2 hover:text-fg"}`}
    >
      {children}
    </button>
  );
}
