import { Block, Lines, PageHero, PageShell } from "@/components/ui";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Privacy notice (draft)",
  description: "What QuantumLedger collects, why, and for how long. Draft pending legal review.",
  path: "/privacy",
});

export default function Privacy() {
  return (
    <PageShell>
      <PageHero
        label="Privacy · draft for legal review"
        title="We collect as little as we can."
        lead="This is an honest draft written by the team. It has not been reviewed by a lawyer yet, including against India’s Digital Personal Data Protection Act, 2023."
      />
      <Block label="What we collect" title="Only what you send us.">
        <Lines
          items={[
            "Early-access and contact forms: name, email, organisation, sector and your message",
            "URL scans: the hostname you enter and the result, kept so results can be shared. Not your IP address",
            "Analytics, if enabled: privacy-friendly page and event counts (Plausible), without cookies or personal data",
          ]}
        />
      </Block>
      <Block label="What we don’t" title="No tracking, no selling.">
        <p>
          No advertising trackers, no cookies for analytics, and we never sell or share your
          details. The live demos run in your browser or on our server; your browser’s generated
          keys never leave it.
        </p>
      </Block>
      <Block label="Retention and rights" title="Ask, and we’ll delete it.">
        <p>
          We keep form submissions until you ask us to delete them, or for 24 months after our last
          contact. Email us through the contact page to see, correct or delete your data.
        </p>
      </Block>
    </PageShell>
  );
}
