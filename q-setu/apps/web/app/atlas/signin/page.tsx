import type { Metadata } from "next";
import { Suspense } from "react";
import { AtlasSignIn } from "@/components/atlas/AtlasSignIn";
import { Container } from "@/components/ui/layout";
import { PageHero, PageShell } from "@/components/ui";
import { pageMeta } from "@/lib/meta";

export const metadata: Metadata = pageMeta({
  title: "Sign in · Q-Shield",
  description: "Sign in to the Q-Shield pipeline.",
  path: "/atlas/signin",
});

export default function AtlasSignInPage() {
  return (
    <PageShell>
      <PageHero
        label="Q-Shield pipeline"
        title="Sign in"
        lead="Q-Shield accounts are separate from QuantumLedger's: an Atlas admin creates them."
      />
      <Container className="pb-24 pt-10">
        <Suspense fallback={<div className="h-stage-sm" aria-busy="true" />}>
          <AtlasSignIn />
        </Suspense>
      </Container>
    </PageShell>
  );
}
