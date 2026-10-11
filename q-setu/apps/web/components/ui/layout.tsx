import type { ReactNode } from "react";
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
  children,
  className = "",
}: {
  id?: string;
  index?: string;
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`relative scroll-mt-14 py-24 md:py-40 ${className}`}>
      <Container>
        {label && (
          <Label className="mb-6 block">
            {index ? `${index} — ` : ""}
            {label}
          </Label>
        )}
        {children}
      </Container>
    </section>
  );
}

export function Divider({ className = "" }: { className?: string }) {
  return <hr className={`border-0 border-t border-line ${className}`} />;
}
