import type { ReactNode } from "react";

type HeadingVariant = "display" | "h1" | "h2" | "h3";
const HEADING: Record<HeadingVariant, string> = {
  display: "text-display-sm md:text-display",
  h1: "text-h1-sm md:text-h1",
  h2: "text-h2",
  h3: "text-h3",
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

/** Body copy: 16/26 in --text-2, or 14/22 for `small`. */
export function Text({
  as: Tag = "p",
  size = "body",
  children,
  className = "",
}: {
  as?: "p" | "span" | "div";
  size?: "body" | "small";
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag className={`${size === "body" ? "text-body" : "text-small"} text-fg-2 ${className}`}>
      {children}
    </Tag>
  );
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
