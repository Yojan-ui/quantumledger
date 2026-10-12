import type { ReactNode } from "react";
import { Copy } from "./Copy";
/**
 * Crypto roles: one colour per meaning, used everywhere (see styles/tokens.css).
 * A dot sits at 60% and brightens to 100% on hover or focus, with a one-line explanation.
 */
export type Role = "kem" | "sig" | "ok" | "warn" | "danger";

export const ROLES: Record<
  Role,
  { label: string; means: string; plain: string; text: string; bg: string }
> = {
  kem: {
    label: "Encrypted",
    means: "Sealed with ML-KEM: unreadable, even to a future quantum computer.",
    plain: "Locked with a quantum-safe key: unreadable, even to a future quantum computer.",
    text: "text-kem",
    bg: "bg-kem",
  },
  sig: {
    label: "Signed",
    means: "Signed with ML-DSA: any edit or forgery is detectable.",
    plain: "Signed with a quantum-safe signature: any edit or forgery shows.",
    text: "text-sig",
    bg: "bg-sig",
  },
  ok: {
    label: "Verified",
    means: "Checked just now and protected.",
    plain: "Checked just now and protected.",
    text: "text-ok",
    bg: "bg-ok",
  },
  warn: {
    label: "Vulnerable",
    means: "Classical crypto: recordable today, breakable at Q-Day.",
    plain: "Old-style lock: can be copied today and opened on Q-Day.",
    text: "text-warn",
    bg: "bg-warn",
  },
  danger: {
    label: "Tampered",
    means: "An attack or edit was caught and rejected.",
    plain: "An attack or edit was caught and rejected.",
    text: "text-danger",
    bg: "bg-danger",
  },
};

function Tip({ children, align }: { children: ReactNode; align: "left" | "right" }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute bottom-full ${align === "right" ? "right-0" : "left-0"} z-40 mb-2 hidden w-max max-w-text rounded-sm border border-line-strong bg-raised px-3 py-2 text-small normal-case tracking-normal text-fg-2 group-hover:block group-focus-visible:block`}
    >
      {children}
    </span>
  );
}

/** A role dot with its meaning on hover. `label` shows the role name beside it. */
export function RoleDot({
  role,
  label = false,
  className = "",
  align = "left",
}: {
  role: Role;
  label?: boolean | string;
  className?: string;
  /** Which edge the tooltip lines up with (use "right" near the right of the screen). */
  align?: "left" | "right";
}) {
  const r = ROLES[role];
  const name = typeof label === "string" ? label : r.label;
  return (
    <span
      tabIndex={0}
      className={`group relative inline-flex items-center gap-2 outline-none ${className}`}
    >
      <span
        aria-hidden
        className={`block h-dot w-dot shrink-0 rounded-full opacity-60 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${r.bg}`}
      />
      {label ? (
        <span className="transition-colors duration-150 group-hover:text-fg">{name}</span>
      ) : (
        <span className="sr-only">{name}</span>
      )}
      {/* Screen readers get the meaning as text; sighted users get it in the hover/focus tooltip. */}
      <span className="sr-only">
        : <Copy simple={r.plain} technical={r.means} />
      </span>
      <Tip align={align}>
        <Copy simple={r.plain} technical={r.means} />
      </Tip>
    </span>
  );
}

/** The colour legend: shown beside the globe and in every demo. */
export function Legend({
  roles = ["kem", "sig", "ok", "warn"],
  className = "",
  align = "left",
}: {
  roles?: Role[];
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <div
      role="group"
      aria-label="Colour legend"
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-label uppercase text-fg-3 ${className}`}
    >
      {roles.map((r) => (
        <RoleDot key={r} role={r} label align={align} />
      ))}
    </div>
  );
}
