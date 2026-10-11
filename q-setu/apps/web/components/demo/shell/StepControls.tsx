"use client";

import { Button } from "@/components/ui";
import { usePresent } from "@/lib/client/present";

interface Props {
  onStep: () => void;
  onPlay: () => void;
  onReset: () => void;
  playing: boolean;
  busy?: boolean;
  done?: boolean;
  stepLabel?: string;
  playLabel?: string;
  /** Whether Play is this viewport's one primary action. */
  primaryPlay?: boolean;
  /** Presenter ←: one step back where that's meaningful; otherwise back to the start. */
  onBack?: () => void;
}

export function StepControls({
  onStep,
  onPlay,
  onReset,
  playing,
  busy,
  done,
  stepLabel = "Step",
  playLabel = "Play",
  primaryPlay = true,
  onBack,
}: Props) {
  // Presenter mode: → steps, ← goes back, R resets. Real crypto steps can't be un-run, so ← restarts
  // demos that have no meaningful "previous" state.
  usePresent({
    next: () => !busy && !playing && !done && onStep(),
    prev: () => !playing && (onBack ?? onReset)(),
    reset: onReset,
  });
  return (
    <div
      data-present-target
      className="flex items-center gap-2"
      role="group"
      aria-label="Demo controls"
    >
      <Button onClick={onStep} disabled={busy || playing || done}>
        {stepLabel}
      </Button>
      <Button
        variant={primaryPlay ? "primary" : "secondary"}
        onClick={onPlay}
        disabled={(busy && !playing) || (done && !playing)}
        aria-pressed={playing}
      >
        {playing ? "Pause" : playLabel}
      </Button>
      <button
        type="button"
        onClick={onReset}
        disabled={playing}
        className="h-10 px-2 text-small text-fg-3 transition-colors duration-150 hover:text-fg disabled:opacity-40"
      >
        Reset
      </button>
    </div>
  );
}
