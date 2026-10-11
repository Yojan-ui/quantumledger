import type { ReactNode } from "react";

/**
 * Raised panel: 1px border, 12px radius, 32px padding. On hover the border brightens and a soft
 * spotlight (--line-strong at ~6%) follows the cursor, clipped to the panel (see .spotlight).
 */
export function Panel({
  children,
  className = "",
  padded = true,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  as?: "div" | "article" | "section" | "li";
}) {
  return (
    <Tag
      data-spotlight
      className={`spotlight rounded-lg border border-line bg-raised transition-colors duration-150 hover:border-line-strong ${padded ? "p-6 md:p-8" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}
