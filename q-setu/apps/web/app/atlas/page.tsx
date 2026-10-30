import type { Metadata } from "next";
import { AtlasHome } from "@/components/atlas/AtlasHome";
import { Container } from "@/components/ui/layout";
import { PageHero, PageShell } from "@/components/ui";
import { pageMeta } from "@/lib/meta";

export const metadata: Metadata = pageMeta({
  title: "Q-Shield pipeline",
  description:
    "Find quantum-breakable crypto in a codebase, plan the migration with QpiAI Opt, gate every wave on real TLS 1.3 handshakes and sign each result into an ML-DSA-65 Proof Chain.",
  path: "/atlas",
});

/** Q-Shield (Atlas) home: workspaces, sign-in and bring-your-own source. Data comes from /atlas-api/*. */
export default function AtlasPage() {
  return (
    <PageShell>
      <PageHero
        label="Q-Shield pipeline"
        title="Find quantum-breakable crypto, fix it in order, prove it."
        lead="Detect → Proof Chain → Plan → Handshake gates → Wave selection → Proof verified → Review. Every number on these pages comes from a logged Atlas run."
      />
      <Container className="pb-24">
        <AtlasHome />
      </Container>
    </PageShell>
  );
}
