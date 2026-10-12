"use client";

import { RoomFeed } from "./RoomFeed";
import { RoomQR } from "./RoomQR";

/** Presenter mode's join code (Q): large enough to scan from the back of a room. */
export function RoomPanel({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="Join live from your phone"
      className="fixed bottom-6 right-6 z-50 w-full max-w-text rounded-lg border border-line-strong bg-raised p-6"
    >
      <RoomQR size="lg" className="flex-col items-start" />
      <RoomFeed className="mt-6" />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 font-mono text-label uppercase text-fg-3 hover:text-fg"
      >
        Close · Q
      </button>
    </div>
  );
}
