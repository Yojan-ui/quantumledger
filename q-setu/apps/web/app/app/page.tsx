import type { Metadata } from "next";
import { Dashboard } from "@/components/app/Dashboard";
import { Container, Label, PageShell } from "@/components/ui";
import { currentSession } from "@/lib/server/dashboard";

export const metadata: Metadata = {
  title: "Shield dashboard",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AppPage() {
  const s = await currentSession();
  return (
    <PageShell>
      <Container className="py-16 md:py-24">
        <Label>Shield</Label>
        <h1 className="mb-8 mt-3 text-h2 font-medium text-fg">Dashboard</h1>
        <Dashboard initial={s ? s.stage : "out"} />
      </Container>
    </PageShell>
  );
}
