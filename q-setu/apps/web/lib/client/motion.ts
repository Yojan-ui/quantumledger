"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** True when the visitor asked for reduced motion. Data keeps updating; only movement stops. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (fn) => {
      const m = window.matchMedia(QUERY);
      m.addEventListener("change", fn);
      return () => m.removeEventListener("change", fn);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia(QUERY).matches;
