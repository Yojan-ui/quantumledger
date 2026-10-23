import Link from "next/link";
import { MARK_PATHS, WORDMARK } from "@/lib/brand/mark";

/** The monogram alone (favicon-weight strokes), in the current text colour. */
export function Mark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {MARK_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Monogram + wordmark, linking home. */
export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 text-fg"
      aria-label="QuantumLedger home"
      data-sealed
    >
      <Mark />
      <span className="font-mono text-small font-medium tracking-widest">{WORDMARK}</span>
    </Link>
  );
}
