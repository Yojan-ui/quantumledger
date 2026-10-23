import type { ReactNode } from "react";

type HeadingVariant = "display" | "h1" | "h2" | "h3";
const HEADING: Record<HeadingVariant, string> = {
  display: "text-display-sm md:text-display",
  // Steps up with the columns (35 → 44 → 56), so one long word always fits a 5–6 column text column.
  h1: "text-h1-sm md:text-h2 xl:text-h1",
  h2: "text-h3 md:text-h2",
  h3: "text-body md:text-h3",
};

/** Headings are always --text, weight 500. `as` controls the element; `variant` the size. */
export function Heading({
  as: Tag = "h2",
  variant = "h1",
  children,
  className = "",
}: {
  as?: "h1" | "h2" | "h3" | "h4" | "p";
  variant?: HeadingVariant;
  children: ReactNode;
  className?: string;
}) {
  return <Tag className={`${HEADING[variant]} font-medium text-fg ${className}`}>{children}</Tag>;
}

const TEXT = {
  /** The subhead step: 22/32, primary tone. */
  lead: "text-lead text-fg",
  /** Body copy: 18/28 in the secondary tone, at most 62 characters wide. */
  body: "max-w-prose text-body text-fg-2",
  small: "text-small text-fg-2",
} as const;

/** Body copy (18/28, secondary tone, 62ch), its `lead` subhead step, or 14/22 `small`. */
export function Text({
  as: Tag = "p",
  size = "body",
  children,
  className = "",
}: {
  as?: "p" | "span" | "div";
  size?: keyof typeof TEXT;
  children: ReactNode;
  className?: string;
}) {
  return <Tag className={`${TEXT[size]} ${className}`}>{children}</Tag>;
}

/** Mono uppercase label: indices, data labels, captions. --text-3 by default. */
export function Label({
  as: Tag = "span",
  tone = "muted",
  children,
  className = "",
}: {
  as?: "span" | "p" | "dt" | "th" | "div" | "h2" | "h3";
  tone?: "muted" | "strong";
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag
      className={`font-mono text-label uppercase ${tone === "strong" ? "text-fg" : "text-fg-3"} ${className}`}
    >
      {children}
    </Tag>
  );
}
