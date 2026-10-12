"use client";

import { dismissToast, useToast } from "@/lib/client/toast";

/** Renders the current failure toast: a short message, Retry (if the action can run again), ×. */
export function ToastHost() {
  const t = useToast();
  if (!t) return null;
  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-50 flex max-w-label items-center gap-3 border border-danger bg-raised px-3 py-2 text-small text-fg"
    >
      <span className="min-w-0">{t.text}</span>
      {t.retry && (
        <button
          type="button"
          onClick={() => {
            dismissToast();
            void t.retry?.();
          }}
          className="font-mono text-label uppercase text-kem underline-offset-4 hover:underline"
        >
          Retry
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismissToast}
        className="text-fg-3 transition-colors duration-150 hover:text-fg"
      >
        ×
      </button>
    </div>
  );
}
