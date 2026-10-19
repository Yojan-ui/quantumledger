"use client";

import { useEffect, useRef } from "react";

/** Presenter-mode commands, broadcast to whatever demo is on screen. */
/** `play` starts a film's autoplay if it isn't already playing (used by the judge tour). */
export type PresentCommand = "next" | "prev" | "reset" | "play";
const EVENT = "qsetu:present";

export const sendPresent = (cmd: PresentCommand) =>
  window.dispatchEvent(new CustomEvent<PresentCommand>(EVENT, { detail: cmd }));

/** Subscribes a demo to presenter commands (→ next, ← previous, R reset). */
export function usePresent(handlers: Partial<Record<PresentCommand, () => void>>) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const on = (e: Event) => ref.current[(e as CustomEvent<PresentCommand>).detail]?.();
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
}

/** True if any demo on the page claimed presenter commands (otherwise →/← scroll sections). */
export const demoOnPage = () => !!document.querySelector("[data-present-target]");

/**
 * Restores every demo's server state: recordings, ledger edits, crypto policy. In production that
 * changes the demo for every visitor, so it needs the admin sign-in: resolves false (and resets
 * nothing) when the server refuses, so the UI never claims a reset that didn't happen.
 */
export async function resetAll(): Promise<boolean> {
  const ok = await fetch("/api/reset-all", { method: "POST" }).then(
    (r) => r.ok,
    () => false,
  );
  if (ok) sendPresent("reset");
  return ok;
}
