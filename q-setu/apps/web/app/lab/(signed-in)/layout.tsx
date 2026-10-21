import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageShell } from "@/components/ui";

export const metadata: Metadata = {
  title: "Lab",
  robots: { index: false, follow: false },
};

/** Every signed-in Lab page sits inside the site's own nav and footer. Each page checks the session. */
export default function LabLayout({ children }: { children: ReactNode }) {
  return <PageShell>{children}</PageShell>;
}
