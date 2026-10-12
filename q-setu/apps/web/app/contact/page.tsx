import { EarlyAccessForm } from "@/components/forms/EarlyAccessForm";
import { Container, PageHero, PageShell } from "@/components/ui";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Contact",
  description: "Talk to the QuantumLedger team about pilots, pricing or security.",
  path: "/contact",
});

export default function Contact() {
  return (
    <PageShell>
      <PageHero
        label="Contact"
        title="Talk to the team."
        lead="Pilots, pricing, a security report or a question about the code: we read everything ourselves."
      />
      <Container className="py-16 md:py-24">
        <EarlyAccessForm kind="contact" />
      </Container>
    </PageShell>
  );
}
