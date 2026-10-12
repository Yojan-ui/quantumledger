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
 * host warm. Pages keep showing their cached or last-known data underneath.
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
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-3 border border-line bg-raised px-3 py-2 font-mono text-micro text-fg-2"
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
  );
}
