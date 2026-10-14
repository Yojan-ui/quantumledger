"use client";

import { useEffect } from "react";
import { checkHealth, useServerStatus } from "@/lib/client/server";

const COPY = {
  waking: "Waking up the server…",
  reconnecting: "Reconnecting to live data…",
  down: "Can't reach the server.",
} as const;

/**
 * A small fixed note while the API is cold, unreachable or a live stream is reconnecting. Checks
 * /api/health on load and every 4 minutes while the tab is visible, which also keeps a sleeping
 * host warm. Pages keep showing their cached or last-known data underneath. It sits as a slim status
 * line just under the nav (where page padding is), not over a panel, and only after 2 s of silence.
 */
export function ServerNote() {
  const status = useServerStatus();
  useEffect(() => {
    void checkHealth();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void checkHealth();
    }, 240_000);
    return () => clearInterval(t);
  }, []);
  if (status === "ok") return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-14 z-30 flex justify-center">
      <div
        role="status"
        className="pointer-events-auto flex items-center gap-3 border border-t-0 border-line bg-raised px-3 py-1 font-mono text-micro text-fg-2"
      >
      <span>{COPY[status]}</span>
      {status === "down" && (
        <button
          type="button"
          onClick={() => void checkHealth()}
          className="text-kem underline-offset-4 hover:underline"
        >
          Retry
        </button>
      )}
      </div>
    </div>
  );
}
