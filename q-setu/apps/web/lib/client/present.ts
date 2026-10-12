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

/** Restores every demo's server state: recordings, ledger edits, crypto policy. */
export async function resetAll(): Promise<void> {
  await fetch("/api/reset-all", { method: "POST" }).catch(() => {});
  sendPresent("reset");
}
