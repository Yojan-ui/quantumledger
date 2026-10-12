"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const DEMOS = [
  "/demo/how-it-works",
  "/demo/deploy",
  "/demo/qday",
  "/demo/ledger",
  "/index",
  "/join",
];

/**
 * After first paint, when the browser is idle: prefetch the demo routes and download the 3D films'
 * code, so a click on a demo opens instantly. Skipped on slow or data-saving connections.
 */
export function Warmup() {
  const router = useRouter();
  useEffect(() => {
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    };
    if (nav.connection?.saveData || /2g/.test(nav.connection?.effectiveType ?? "")) return;
    const w = window as Window & typeof globalThis;
    const idle = (fn: () => void, timeout: number) =>
      typeof w.requestIdleCallback === "function"
        ? w.requestIdleCallback(fn, { timeout })
        : setTimeout(fn, 1200);
    const go = () => {
      DEMOS.forEach((p) => router.prefetch(p));
      // A second idle slot for the heavier 3D code (fetched and parsed, not mounted).
      idle(() => {
        void import("@/components/world/SceneView");
        void import("@/components/demo/handshake/HandshakeFilm");
        void import("@/components/demo/qday/QDayFilm");
        void import("@/components/demo/ledger/LedgerFilm");
      }, 6000);
    };
    if (document.readyState === "complete") idle(go, 3000);
    else window.addEventListener("load", () => idle(go, 3000), { once: true });
  }, [router]);
  return null;
}
