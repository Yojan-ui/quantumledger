"use client";

/**
 * The big screen's half of the room: a counter of messages this audience has sealed, and a label
 * that pops for each packet ("Sealed by Visitor 3 · 1,120 B · 0.6 ms"). Sizes and timings are the
 * real ones: bytes on the wire, the phone's own seal time and the server's open time.
 */
import { useEffect, useState } from "react";
import { Odometer } from "@/components/ui/Odometer";
import { roomCity, visitorCss } from "@/data/room";
import type { RoomEvent } from "@/lib/live/room";
import { onRoom, useRoomStats } from "@/lib/client/room";
import { ms } from "@/lib/format";

type Pop = Extract<RoomEvent, { kind: "sealed" | "rejected" }>;

export function RoomFeed({ className = "" }: { className?: string }) {
  const stats = useRoomStats();
  const [pops, setPops] = useState<Pop[]>([]);
  useEffect(
    () =>
      onRoom((e) => {
        if (e.kind === "join") return;
        setPops((p) => [e, ...p].slice(0, 3));
        setTimeout(() => setPops((p) => p.filter((x) => x.seq !== e.seq)), 4200);
      }),
    [],
  );
  const n = stats?.sealed ?? 0;
  return (
    <div className={className} data-room-feed>
      <p className="text-small text-fg-2" aria-live="polite">
        <span className="font-mono text-h3 text-fg">
          <Odometer value={n.toLocaleString("en-IN")} />
        </span>{" "}
        {n === 1 ? "message" : "messages"} sealed live by this audience
        {stats && stats.rejected > 0 && (
          <span className="text-fg-3"> · {stats.rejected} tampered, all rejected</span>
        )}
      </p>
      <ul className="mt-3 space-y-2" aria-live="polite">
        {pops.map((p) => (
          <li
            key={p.seq}
            className="flex animate-tick-in items-center gap-2 font-mono text-label text-fg-2"
            data-room-pop={p.kind}
          >
            <span
              aria-hidden
              className="inline-block h-dot w-dot rounded-full"
              style={{
                background: p.kind === "sealed" ? visitorCss(p.visitor.colour) : "var(--danger)",
              }}
            />
            {p.kind === "sealed" ? (
              <span>
                Sealed by {p.visitor.name}
                {p.emoji ? ` ${p.emoji}` : ""} · {p.bytes.toLocaleString("en-IN")} B ·{" "}
                {ms(p.sealMs)} · from {roomCity(p.visitor.city).label}
              </span>
            ) : (
              <span className="text-danger">
                {p.visitor.name}&apos;s tampered packet rejected · {p.reason.slice(0, 60)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
