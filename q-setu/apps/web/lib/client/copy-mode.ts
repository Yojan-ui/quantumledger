"use client";

/**
 * Simple / Technical copy. The mode lives on <html data-copy-mode> (set before first paint by an
 * inline script in the root layout, from localStorage) so CSS can show the right copy without a
 * flash. Simple is the default.
 */
import { useSyncExternalStore } from "react";
import { COPY_KEY } from "@/lib/copy-mode-script";

export type CopyMode = "simple" | "technical";
const listeners = new Set<() => void>();

const read = (): CopyMode =>
  typeof document !== "undefined" && document.documentElement.dataset.copyMode === "technical"
    ? "technical"
    : "simple";

export function setCopyMode(m: CopyMode) {
  document.documentElement.dataset.copyMode = m;
  try {
    localStorage.setItem(COPY_KEY, m);
  } catch {
    /* private mode */
  }
  listeners.forEach((fn) => fn());
}

export function useCopyMode(): CopyMode {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    read,
    () => "simple",
  );
}
