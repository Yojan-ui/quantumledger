import type { ReactNode } from "react";
import { Label } from "./type";

/** A number at h1 size with tabular numerals, a mono label under it and an optional source footnote. */
export function Stat({
  value,
  label,
  footnote,
  className = "",
}: {
  value: ReactNode;
  label: string;
  footnote?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="tabular text-h1-sm font-medium text-fg md:text-h1">{value}</p>
      <Label as="p" className="mt-2">
        {label}
        {footnote && <span className="normal-case"> {footnote}</span>}
      </Label>
    </div>
  );
}

/** Small inline mono stat for the hero row and the Compute Meter. */
export function MiniStat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div>
      <p className="tabular font-mono text-small text-fg">{value}</p>
      <Label as="p" className="mt-1">
        {label}
      </Label>
    </div>
  );
}
