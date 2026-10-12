import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary";

const BASE =
  "relative inline-flex h-10 overflow-hidden shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm px-4 text-small font-medium transition duration-150 disabled:cursor-not-allowed disabled:opacity-40";
const STYLE: Record<Variant, string> = {
  primary: "bg-fg text-base hover:opacity-90",
  secondary: "border border-line-strong text-fg hover:bg-raised",
};

export const buttonClass = (variant: Variant = "primary") => `${BASE} ${STYLE[variant]}`;

/**
 * Data attributes the global <Interactions /> reads: every button pulls up to 4px towards the
 * cursor; a primary also shimmers once, the first time it scrolls into view.
 */
const motion = (variant: Variant) =>
  variant === "primary" ? { "data-magnetic": "", "data-shimmer": "" } : { "data-magnetic": "" };

export function Button({
  variant = "secondary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      type="button"
      {...motion(variant)}
      {...props}
      className={`${buttonClass(variant)} ${className}`}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  children,
  className = "",
  external,
}: {
  href: string;
  variant?: Variant;
  children: ReactNode;
  className?: string;
  external?: boolean;
}) {
  if (external) {
    return (
      <a href={href} {...motion(variant)} className={`${buttonClass(variant)} ${className}`}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} {...motion(variant)} className={`${buttonClass(variant)} ${className}`}>
      {children}
    </Link>
  );
}

/** Text link with an optional arrow; colour shifts on hover only. */
export function TextLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`text-small text-fg transition-opacity duration-150 hover:opacity-70 ${className}`}
    >
      {children}
    </Link>
  );
}
