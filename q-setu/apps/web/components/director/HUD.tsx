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
  beat,
}: {
  director: Director;
  steps: Step[];
  playing: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onReplay: () => void;
  busy?: boolean;
  /**
   * The film's beat (useFilm): when given, the caption is that shot's and changes only when its
   * real event has happened and the camera has arrived, never as the camera starts to move.
   */
  beat?: number;
}) {
  const { shot, index, take } = director.state;
  const step = shot.step ?? -1;
  const shownIndex = beat ?? index;
  const shown = shownIndex === index ? shot : (director.shots[shownIndex] ?? shot);

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
      className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 p-4 md:p-6"
    >
      {/* Caption: one line, revealed through a mask on every shot change. */}
      <p
        className="max-w-text overflow-hidden pb-1 text-center text-body font-medium text-fg md:text-h3"
        aria-live="polite"
        data-label-avoid
      >
        <span key={`${shownIndex}-${take}`} className="block animate-mask-up">
          <Copy simple={shown.simple ?? shown.caption} technical={shown.caption} />
        </span>
      </p>
      {/* The floating pill: the step bar and Prev / Next / Play / Replay, bottom centre. */}
      <div
        data-label-avoid
        className="pointer-events-auto flex max-w-full items-center justify-center gap-x-3 rounded-full border border-line bg-glass px-3 py-2 md:gap-x-4"
      >
        <ol className="flex items-center gap-2 font-mono text-label uppercase" aria-label="Shots">
          {steps.map((s, i) => (
            <li
              key={s.label}
              aria-current={i === step ? "step" : undefined}
              className={`flex items-center gap-2 transition-colors duration-300 ${i === step ? "text-fg" : i < step ? "text-fg-2" : "text-fg-3"}`}
            >
              <span
                aria-hidden
                className={`block h-1 rounded-full transition duration-300 ${ROLES[s.role].bg} ${i === step ? "w-6 opacity-100" : i < step ? "w-3 opacity-40" : "w-3 opacity-10"}`}
              />
              <span className={i === step ? "sr-only md:not-sr-only" : "sr-only"}>
                {String(i + 1).padStart(2, "0")} {s.label}
              </span>
            </li>
          ))}
        </ol>
        <span aria-hidden className="h-4 border-l border-line-strong" />
        <div className="flex items-center gap-1" role="group" aria-label="Shot controls">
          <HudButton onClick={onPrev} disabled={busy} label="Previous shot">
            ←
          </HudButton>
          <HudButton onClick={onToggle} pressed={playing} label={playing ? "Pause" : "Play"}>
            {playing ? "Pause" : "Play"}
          </HudButton>
          <HudButton onClick={onNext} disabled={busy} label="Next shot">
            →
          </HudButton>
          <HudButton onClick={onReplay} label="Replay">
            Replay
          </HudButton>
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
  label,
}: {
  children: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={label}
      className={`h-8 min-w-8 rounded-full px-3 font-mono text-label uppercase transition-colors duration-150 disabled:opacity-40 ${pressed ? "bg-raised text-fg" : "text-fg-2 hover:bg-raised hover:text-fg"}`}
    >
      {children}
    </button>
  );
}
