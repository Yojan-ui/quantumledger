import type { ReactNode } from "react";

/**
 * A HUD glass panel: 3% white over the stage, an 8px blur, a hairline border and thin bracket marks
 * at the corners instead of a rounded box. Mono uppercase 11px label.
 */
export function HudPanel({
  label,
  right,
  children,
  className = "",
  id,
  glass = true,
}: {
  label: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  /** false: no glass tint over the stage (a panel that holds the 3D view) */
  glass?: boolean;
}) {
  return (
    <section
      id={id}
      aria-label={label}
      className={`relative flex min-h-0 flex-col border border-line ${glass ? "bg-glass" : ""} ${className}`}
    >
      {/* Bracket marks: 12px L-shapes at each corner, a shade brighter than the hairline. */}
      <span
        aria-hidden
        className="absolute -left-px -top-px h-3 w-3 border-l border-t border-line-strong"
      />
      <span
        aria-hidden
        className="absolute -right-px -top-px h-3 w-3 border-r border-t border-line-strong"
      />
      <span
        aria-hidden
        className="absolute -bottom-px -left-px h-3 w-3 border-b border-l border-line-strong"
      />
      <span
        aria-hidden
        className="absolute -bottom-px -right-px h-3 w-3 border-b border-r border-line-strong"
      />
      <header className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
        <h2 className="font-mono text-micro uppercase text-fg-3">{label}</h2>
        {right}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
