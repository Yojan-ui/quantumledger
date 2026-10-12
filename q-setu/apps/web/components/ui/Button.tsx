"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { shortError, showToast } from "@/lib/client/toast";

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
 * aria-busy (progress cursor, the busy style in globals.css), so async steps can't run twice. When it
 * settles the button flashes done (data-state="done") or, if it failed, error, and a toast gives a
 * short message with Retry.
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
  const [state, setState] = useState<"done" | "error">();
  const flash = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(flash.current), []);
  const settle = (s: "done" | "error") => {
    setState(s);
    clearTimeout(flash.current);
    flash.current = setTimeout(() => setState(undefined), 1200);
  };
  const click = (e: MouseEvent<HTMLButtonElement>) => {
    const now = performance.now();
    if (busy || now - last.current < 350) return;
    last.current = now;
    const r = onClick?.(e);
    if (r instanceof Promise) {
      setBusy(true);
      setState(undefined);
      r.then(
        () => settle("done"),
        (err: unknown) => {
          settle("error");
          // A short message and a retry that runs the same step again (steps are safe to repeat).
          showToast(shortError(err), () => onClick?.(e));
        },
      ).finally(() => setBusy(false));
    }
  };
  return (
    <button
      type="button"
      {...motion(variant)}
      {...props}
      onClick={onClick && click}
      aria-busy={busy || props["aria-busy"] || undefined}
      data-state={state}
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
