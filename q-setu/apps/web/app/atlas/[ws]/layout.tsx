import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/atlas/WorkspaceShell";
import { PageShell } from "@/components/ui";

/** Every /atlas/[ws]/<step> page: the workspace header and the seven step tabs. */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <PageShell>
      <WorkspaceShell>{children}</WorkspaceShell>
    </PageShell>
  );
}
