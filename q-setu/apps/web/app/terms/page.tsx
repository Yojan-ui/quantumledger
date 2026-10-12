import { Block, PageHero, PageShell } from "@/components/ui";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Terms (draft)",
  description: "Terms of use for the QuantumLedger website and demos. Draft pending legal review.",
  path: "/terms",
});

export default function Terms() {
  return (
    <PageShell>
      <PageHero
        label="Terms · draft for legal review"
        title="Plain terms for an early product."
        lead="A draft by the team, not yet reviewed by a lawyer."
      />
      <Block label="The demos" title="Demonstrations, not a service.">
        <p>
          The website and its demos show how QuantumLedger works. They are provided as they are,
          without warranties, and are not a security service for your systems. Don’t enter real
          personal or production data into the demos.
        </p>
      </Block>
      <Block label="The scanner" title="Scan only what you’re allowed to.">
        <p>
          The URL scanner opens one ordinary TLS connection to a public host, the same as a browser
          does. Only scan sites you own or are permitted to assess. It is rate-limited and refuses
          private addresses.
        </p>
      </Block>
      <Block label="The code" title="Open-source licence.">
        <p>
          The core will be published under an open-source licence, which hasn’t been chosen yet.
          Until then, the code is shared for evaluation. Managed tiers will have their own agreement
          with each customer.
        </p>
      </Block>
    </PageShell>
  );
}
