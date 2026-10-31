"use client";

import type { SectorId } from "@qsetu/sim";

const LABELS: Record<SectorId, string> = {
  fintech: "Fintech",
};

/** Segmented control. Selected: raised fill; others muted. */
export function SectorSwitcher({
  value,
  onChange,
  disabled,
}: {
  value: SectorId;
  onChange: (s: SectorId) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Sector"
      className="inline-flex rounded-sm border border-line p-1"
    >
      {(Object.keys(LABELS) as SectorId[]).map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          disabled={disabled}
          onClick={() => onChange(s)}
          className={`h-8 rounded-sm px-3 text-small transition-colors duration-150 disabled:opacity-40 ${value === s ? "bg-raised text-fg" : "text-fg-3 hover:text-fg"}`}
        >
          {LABELS[s]}
        </button>
      ))}
    </div>
  );
}
