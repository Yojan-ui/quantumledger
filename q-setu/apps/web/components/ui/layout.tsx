import type { ReactNode } from "react";
import { ROLES, type Role } from "./Role";
import { Label } from "./type";

/** 1200px container with 24px side padding (20px on mobile). */
export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-container px-5 md:px-6 ${className}`}>{children}</div>
  );
}

/** 12-column grid with a 24px gutter. */
export function Grid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-12 gap-x-6 ${className}`}>{children}</div>;
}

/** A page section: 160px vertical padding (96px on mobile) and an optional mono index label. */
export function Section({
  id,
  index,
  label,
  role,
  children,
  className = "",
}: {
  id?: string;
  index?: string;
  label?: string;
  /** The section's crypto role: a 6px dot before its index label. */
  role?: Role;
  children: ReactNode;
  className?: string;
}) {
  return (
    // Text-only sections size to their content, 160 px apart (80 above and below each).
    <section id={id} className={`relative scroll-mt-14 py-16 md:py-20 ${className}`}>
      <Container>
        {label && <SectionLabel index={index} label={label} role={role} />}
        {children}
      </Container>
    </section>
  );
}

export function Divider({ className = "" }: { className?: string }) {
  return <hr className={`border-0 border-t border-line ${className}`} />;
}

/** "03 — WHY NOW" with an optional 6px dot in the section's role colour. */
export function SectionLabel({
  index,
  label,
  role,
  className = "mb-6",
}: {
  index?: string;
  label: string;
  role?: Role;
  className?: string;
}) {
  return (
    <Label className={`flex items-center gap-3 ${className}`}>
      {role && <span aria-hidden className={`block h-dot w-dot rounded-full ${ROLES[role].bg}`} />}
      <span>
        {index ? `${index} — ` : ""}
        {label}
      </span>
    </Label>
  );
}
