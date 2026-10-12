"use client";

/**
 * A label pinned to a 3D object: a 1px leader line, a mono 12px label and a value
 * (e.g. "ML-KEM-768 ct · 1,088 B"). It fades in after the camera settles and out before it moves.
 */
import { Html } from "@react-three/drei";
import type { ReactNode } from "react";
import type { Role } from "@/components/ui/Role";

const TEXT: Record<Role, string> = {
  kem: "text-kem",
  sig: "text-sig",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
};

export function Anchor({
  position,
  label,
  value,
  role,
  show,
  side = "up",
}: {
  position: [number, number, number];
  label: string;
  value?: ReactNode;
  role?: Role;
  show: boolean;
  side?: "up" | "down";
}) {
  return (
    <Html position={position} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      {/* Visual only: each stage describes itself to screen readers (and the page states the result). */}
      <div
        aria-hidden
        className={`flex flex-col items-center transition-opacity duration-300 ${show ? "opacity-100" : "opacity-0"}`}
        style={{ transform: side === "up" ? "translateY(-50%)" : "translateY(50%)" }}
      >
        {side === "down" && <span aria-hidden className="block h-6 w-px bg-line-strong" />}
        <div className="whitespace-nowrap rounded-sm border border-line bg-base px-2 py-1 text-center font-mono text-label uppercase">
          <span className={role ? TEXT[role] : "text-fg-3"}>{label}</span>
          {value !== undefined && <span className="block normal-case text-fg">{value}</span>}
        </div>
        {side === "up" && <span aria-hidden className="block h-6 w-px bg-line-strong" />}
      </div>
    </Html>
  );
}
