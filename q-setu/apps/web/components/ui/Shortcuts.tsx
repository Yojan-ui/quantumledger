"use client";

import { useEffect, useState } from "react";
import { lockScroll } from "@/lib/client/scroll";

const KEYS: [string, string][] = [
  ["← →", "Previous / next step (demos and diagnostics)"],
  ["Space", "Play or pause"],
  ["R", "Reset the demo"],
  ["⌘K / Ctrl K", "Jump to any page, or scan a site"],
  ["Drag", "Spin the globe or orbit a 3D stage; let go to fling"],
  ["Double-click", "Re-frame the 3D view"],
  ["Click", "A city seals a real packet; a packet in flight or a Proof Chain block opens"],
  ["Esc", "Close a pinned label, this list or the menu"],
  ["?", "Show or hide these shortcuts"],
];

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** `?` opens the site's keyboard and pointer shortcuts. */
export function Shortcuts() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    lockScroll(open);
    return () => lockScroll(false);
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-nav px-5 pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal
        aria-label="Shortcuts"
        className="w-full max-w-text border border-line-strong bg-raised"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="font-mono text-label uppercase text-fg">Shortcuts</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="font-mono text-label uppercase text-fg-3 transition-colors duration-150 hover:text-fg"
          >
            Close
          </button>
        </div>
        <dl className="grid grid-cols-keys gap-x-6 gap-y-2 px-4 py-4 text-small">
          {KEYS.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-label uppercase text-fg">{k}</dt>
              <dd className="text-fg-2">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
