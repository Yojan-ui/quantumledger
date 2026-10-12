"use client";

/**
 * The QR code that brings phones into the room. Dark modules on a --text tile (scanners read
 * dark-on-light best), drawn as one SVG path from the qrcode library's module matrix.
 */
import QRCode from "qrcode";
import { useMemo } from "react";
import { useJoinUrl } from "@/lib/client/room";

export function QrSvg({ text, className = "" }: { text: string; className?: string }) {
  const { d, n } = useMemo(() => {
    const q = QRCode.create(text, { errorCorrectionLevel: "M" });
    const n = q.modules.size;
    let d = "";
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) if (q.modules.get(x, y)) d += `M${x + 2} ${y + 2}h1v1h-1z`;
    return { d, n };
  }, [text]);
  return (
    <svg
      viewBox={`0 0 ${n + 4} ${n + 4}`}
      className={`rounded-sm bg-fg ${className}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code for ${text}`}
    >
      <path d={d} className="fill-base" />
    </svg>
  );
}

export function RoomQR({
  size = "md",
  className = "",
}: {
  size?: "md" | "lg";
  className?: string;
}) {
  const join = useJoinUrl();
  const box = size === "lg" ? "h-80 w-80" : "h-32 w-32";
  return (
    <div className={`flex items-center gap-4 ${className}`} data-room-qr>
      {join ? (
        <QrSvg text={join.url} className={box} />
      ) : (
        <div className={`${box} animate-skeleton rounded-sm bg-raised`} aria-hidden />
      )}
      <div className="min-w-0">
        <p className="text-small text-fg">Join live from your phone</p>
        <p className="mt-1 text-small text-fg-2">
          Scan, seal a message with post-quantum encryption, and watch it land here.
        </p>
        {join && (
          <a href={join.url} className="mt-2 block break-all font-mono text-label text-fg-3">
            {join.url.replace(/^https?:\/\//, "")}
            {join.lan && " · same Wi-Fi"}
          </a>
        )}
      </div>
    </div>
  );
}
