"use client";

import { Button } from "@/components/ui";

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
}: Props) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Demo controls">
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
