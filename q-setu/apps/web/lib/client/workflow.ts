"use client";

import { useSyncExternalStore } from "react";

/**
 * The current step of the page's "How it works" strip, for pages whose step is set by something
 * other than the strip's own props (the scanner reports where the visitor is). One page, one strip.
 */
let step = 0;
const listeners = new Set<() => void>();

export function setWorkflowStep(n: number) {
  if (n === step) return;
  step = n;
  listeners.forEach((fn) => fn());
}

export function useWorkflowStep(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    () => step,
    () => 0,
  );
}
