import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container, Label, PageShell } from "@/components/ui";
import { SignInForm } from "@/components/lab/SignInForm";
import { labEnabled } from "@/lib/lab/auth";
import { pageUser } from "@/lib/lab/data";

export const metadata: Metadata = {
  title: "Lab sign-in",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function LabSignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await pageUser()) redirect("/lab");
  const { error } = await searchParams;
  return (
    <PageShell>
      <Container className="py-16 md:py-24">
        <Label>Lab</Label>
        <h1 className="mt-3 text-h1-sm font-medium text-fg md:text-h2">Sign in to the Lab</h1>
        <p className="mt-3 max-w-prose text-body text-fg-2">
          The Lab shows the attacks Shield recorded on your sites: signed evidence, step-by-step
          timelines and patterns. It’s for the QuantumLedger team and the customers we’ve invited.
        </p>
        {labEnabled() ? (
          <SignInForm {...(error ? { error } : {})} />
        ) : (
          <p className="mt-8 text-body text-fg-2">The Lab is switched off on this server.</p>
        )}
      </Container>
    </PageShell>
  );
}
