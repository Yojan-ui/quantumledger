"use client";

/**
 * The global Q-Day switch (the nav toggle). One shared event in the world store: for 6 seconds the
 * whole site simulates Q-Day. Sample intercepted classical traffic, labelled "(sim)", decrypts
 * into readable text across the page (QDayOverlay); the globe's classical arcs crack (Arcs);
 * everything QuantumLedger protects ([data-sealed]) stays sealed with a --kem glint (globals.css).
 * Then it all restores. Reduced motion: a static before/after instead of the animation.
 */
import { notify, useWorld, world } from "@/components/world/store";

export const QDAY_MS = 6000;
let timer: ReturnType<typeof setTimeout> | undefined;

export function throwQday() {
  if (world.qdayAt) return;
  world.qdayAt = performance.now();
  document.documentElement.setAttribute("data-qday", "");
  notify();
  timer = setTimeout(endQday, QDAY_MS);
}

export function endQday() {
  clearTimeout(timer);
  world.qdayAt = 0;
  document.documentElement.removeAttribute("data-qday");
  notify();
}

export const useQday = () => useWorld((w) => w.qdayAt > 0);
