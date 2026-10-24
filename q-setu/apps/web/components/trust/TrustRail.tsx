"use client";

/**
 * The zero-trust rail: every request this page makes, as it is checked (lib/client/trust). Fixed to
 * the right edge, collapsed to one dot per request: grey while pending, --ok once its signature and
 * hash verify, --danger if rejected, hollow if nothing could check it. Hover a dot for its line;
 * open the rail for the full list, and "Try to tamper" to flip one byte of the next /api/metrics
 * response in this browser: that line is rejected and the readout it feeds keeps its last value.
 */
import { useEffect, useLayoutEffect, useState } from "react";
import { startTrust, tamper, useTrust, type Entry } from "@/lib/client/trust";

const DOTS = 64;

const dotClass: Record<Entry["status"], string> = {
  pending: "bg-fg-3/50",
  ok: "bg-ok",
  bad: "bg-danger",
  skip: "border border-line-strong",
};
const textClass: Record<Entry["status"], string> = {
  pending: "text-fg-3",
  ok: "text-ok",
  bad: "text-danger",
  skip: "text-fg-3",
};

const line = (e: Entry) =>
  `${e.method} ${e.path} · ${e.label}${e.ms !== undefined ? ` · ${e.ms < 10 ? e.ms.toFixed(1) : Math.round(e.ms)} ms` : ""}`;

function Readout() {
  const m = useTrust((s) => s.metrics);
  const refusedAt = useTrust((s) => s.refusedAt);
  const refused = !!refusedAt && (!m || refusedAt > m.at);
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
      <span className="text-fg-3">Server load (verified)</span>
      <span className={refused ? "text-danger" : "text-fg"}>
        {m ? `${m.opsPerSec.toFixed(1)} ops/s` : "…"}
        {refused && " · update refused"}
      </span>
    </div>
  );
}

export function TrustRail() {
  const entries = useTrust((s) => s.entries);
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState<{ e: Entry; y: number } | null>(null);
  // Layout effect: the headline handshake must claim the page before its first paint.
  useLayoutEffect(() => startTrust(), []);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  const ok = entries.filter((e) => e.status === "ok").length;
  const bad = entries.filter((e) => e.status === "bad").length;
  const skip = entries.filter((e) => e.status === "skip").length;
  const shown = entries.slice(-DOTS);
  const summary = `${ok} verified · ${bad} rejected · ${skip} not checked`;

  return (
    <aside aria-label="Zero-trust rail" className="font-mono text-micro uppercase">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-label={`Zero-trust rail: ${summary}. Open the list.`}
          className="fixed right-0 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center border border-r-0 border-line bg-base/70 py-2 transition-colors duration-150 hover:border-line-strong"
          style={{ gap: 3, paddingInline: 5 }}
          onMouseLeave={() => setTip(null)}
        >
          {entries.length > DOTS && (
            <span className="mb-1 leading-none text-fg-3" style={{ fontSize: 9 }}>
              +{entries.length - DOTS}
            </span>
          )}
          {shown.map((e) => (
            <span
              key={e.n}
              className={`block h-1 w-1 rounded-full transition-colors duration-300 ${dotClass[e.status]}`}
              onMouseEnter={(ev) => setTip({ e, y: ev.currentTarget.getBoundingClientRect().top })}
            />
          ))}
          {!shown.length && <span className="block h-1 w-1 rounded-full bg-fg-3/50" />}
        </button>
      )}
      {!open && tip && (
        <div
          className={`pointer-events-none fixed right-6 z-30 truncate border border-line bg-base px-2 py-1 normal-case ${textClass[tip.e.status]}`}
          style={{ top: tip.y - 10, maxWidth: "min(420px, calc(100vw - 48px))" }}
        >
          {line(tip.e)}
        </div>
      )}
      {open && (
        <div
          className="fixed bottom-4 right-0 top-16 z-30 flex flex-col border border-r-0 border-line bg-glass"
          style={{ width: 400, maxWidth: "calc(100vw - 16px)" }}
          data-lenis-prevent
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <span className="text-fg">Zero-trust rail</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-expanded
              className="text-fg-3 transition-colors duration-150 hover:text-fg"
            >
              Close ×
            </button>
          </div>
          <div className="border-b border-line px-4 py-3 text-fg-3">
            <p>{summary}</p>
            <p className="mt-2 normal-case tracking-normal">
              API responses and headlines are verified before they are used. Static files are
              hash-checked against the ML-DSA-65-signed manifest after they load. Anything marked
              “not checked” had nothing to verify it against.
            </p>
          </div>
          <Readout />
          <div className="border-b border-line px-4 py-3">
            <button
              type="button"
              onClick={tamper}
              className="border border-line-strong px-3 py-2 text-fg transition-colors duration-150 hover:border-danger hover:text-danger"
            >
              Try to tamper
            </button>
            <p className="mt-2 normal-case tracking-normal text-fg-3">
              Flips one byte of the next /api/metrics response in this browser, before it is
              checked.
            </p>
          </div>
          <ol
            className="min-h-0 flex-1 overflow-y-auto px-4 py-2"
            aria-label="Requests, newest first"
          >
            {[...entries].reverse().map((e) => (
              <li key={e.n} className="flex items-center gap-2 py-1 normal-case">
                <span className={`block h-1.5 w-1.5 shrink-0 rounded-full ${dotClass[e.status]}`} />
                <span className={`min-w-0 truncate ${textClass[e.status]}`} title={line(e)}>
                  {line(e)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  );
}
