"use client";

/**
 * A label pinned to a 3D object: a 1px leader line, a mono 12px label and a value
 * (e.g. "ML-KEM-768 ct · 1,088 B"). It fades in after the camera settles and out before it moves.
 * The box is laid out by lib/client/labels: kept inside its stage and clear of other labels.
 */
import { Html } from "@react-three/drei";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { registerLabel } from "@/lib/client/labels";
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
  const reg = useRef<ReturnType<typeof registerLabel>>(undefined);
  const shown = useRef(show);
  shown.current = show;
  // <Html> renders its children in a separate React root, after this component's effects: a callback
  // ref registers the box when it really mounts (an effect here would find no box and never lay it out).
  const box = useCallback(
    (el: HTMLDivElement | null) => {
      reg.current?.remove();
      reg.current = el ? registerLabel(el, side) : undefined;
      reg.current?.show(shown.current);
    },
    [side],
  );
  useEffect(() => reg.current?.show(show), [show]);
  useEffect(() => () => reg.current?.remove(), []);
  return (
    <Html position={position} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      {/* Visual only: each stage describes itself to screen readers (and the page states the result). */}
      <div
        aria-hidden
        className={`flex flex-col items-center transition-opacity duration-300 ${show ? "opacity-100" : "opacity-0"}`}
        style={{ transform: side === "up" ? "translateY(-50%)" : "translateY(50%)" }}
      >
        {side === "down" && <span aria-hidden className="block h-6 w-px bg-line-strong" />}
        <div
          ref={box}
          className="whitespace-nowrap rounded-sm border border-line bg-base px-2 py-1 text-center font-mono text-label uppercase"
        >
          <span className={role ? TEXT[role] : "text-fg-3"}>{label}</span>
          {value !== undefined && <span className="block normal-case text-fg">{value}</span>}
        </div>
        {side === "up" && <span aria-hidden className="block h-6 w-px bg-line-strong" />}
      </div>
    </Html>
  );
}
