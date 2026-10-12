"use client";

import Link from "next/link";
import {
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

type Variant = "primary" | "secondary";

const BASE =
  "relative inline-flex h-10 overflow-hidden shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm px-4 text-small font-medium transition duration-150 disabled:cursor-not-allowed disabled:opacity-40 aria-busy:cursor-progress";
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

/**
 * Every button ignores a second click within 350 ms (a double click acts once). If `onClick` returns
 * a promise, the button is busy until it settles: further clicks are ignored and it shows
 * aria-busy (progress cursor, the busy style in globals.css), so async steps can't run twice.
 */
export function Button({
  variant = "secondary",
  className = "",
  children,
  onClick,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  variant?: Variant;
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => unknown;
}) {
  const last = useRef(0);
  const [busy, setBusy] = useState(false);
  const click = (e: MouseEvent<HTMLButtonElement>) => {
    const now = performance.now();
    if (busy || now - last.current < 350) return;
    last.current = now;
    const r = onClick?.(e);
    if (r instanceof Promise) {
      setBusy(true);
      void r.catch(() => {}).finally(() => setBusy(false));
    }
  };
  return (
    <button
      type="button"
      {...motion(variant)}
      {...props}
      onClick={onClick && click}
      aria-busy={busy || props["aria-busy"] || undefined}
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
