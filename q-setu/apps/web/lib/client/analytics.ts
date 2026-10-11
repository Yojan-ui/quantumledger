"use client";

/** Privacy-friendly analytics events (Plausible, only when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set). */
export type EventName =
  "scan_run" | "demo_opened" | "docs_quickstart_viewed" | "early_access_submitted";

export function track(name: EventName, props?: Record<string, string | number | boolean>) {
  const w = window as Window & { plausible?: (n: string, o?: { props?: typeof props }) => void };
  w.plausible?.(name, props ? { props } : undefined);
}
