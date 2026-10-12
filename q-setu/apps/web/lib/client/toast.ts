"use client";

/**
 * One short message at a time for an action that failed, with a Retry that runs it again.
 * Buttons raise it automatically when their async onClick rejects (components/ui/Button).
 */
import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  text: string;
  retry?: () => unknown;
}

let current: Toast | null = null;
let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export function showToast(text: string, retry?: () => unknown) {
  current = { id: ++seq, text, retry };
  clearTimeout(timer);
  timer = setTimeout(dismissToast, 8000);
  emit();
}

export function dismissToast() {
  current = null;
  emit();
}

export function useToast(): Toast | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    () => current,
    () => null,
  );
}

/** A failure as one short sentence: the server's message if it sent one, never a stack. */
export function shortError(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const line = m.split("\n")[0]!.trim();
  if (!line || /failed to fetch|networkerror|load failed/i.test(line))
    return "Couldn't reach the server.";
  return line.length > 120 ? `${line.slice(0, 117)}…` : line;
}
