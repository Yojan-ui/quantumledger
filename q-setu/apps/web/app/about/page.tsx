import { Block, ButtonLink, Lines, PageHero, PageShell } from "@/components/ui";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "About",
  description:
    "Quantum-safe India before Q-Day. Who we are, and the design partners we're looking for.",
  path: "/about",
});

export default function About() {
  return (
    <PageShell>
      <PageHero
        label="About"
        title="Quantum-safe India before Q-Day."
        lead="Data that has to stay secret for decades is being recorded today. We’re building the layer that lets Indian systems adopt NIST’s post-quantum standards without being rewritten."
        globe
      />
      <Block label="Why us" title="Deployment is the hard part.">
        <p>
          The algorithms are standardised and open-source libraries implement them. What stops a
          bank, a hospital or a department is everything around them: legacy cores nobody can touch,
          data at rest, devices in the field, and no inventory of where RSA and elliptic curves are
          used. QuantumLedger is built for that gap.
        </p>
      </Block>
      <Block label="Team" title="Who’s building it.">
        <p>
          QuantumLedger started as a hackathon project and is being built by a small team in India.
          We’d rather show working code than a list of titles. Everything on this site runs live.
        </p>
      </Block>
      <Block label="Design partners wanted" title="Pilot it with us.">
        <p>
          We’re looking for a small number of organisations to run QuantumLedger in shadow mode
          alongside existing systems:
        </p>
        <Lines
          items={[
            "Banks and payment companies (Shield in front of core and switch links)",
            "Hospitals and health-data exchanges (Vault for records, Edge for devices)",
            "Universities and credential registries (ML-DSA-signed certificates)",
          ]}
        />
        <p>
          We don’t have customers to show yet, so you won’t see logos here. You’ll be among the
          first, and you’ll shape what we build.
        </p>
        <div>
          <ButtonLink href="/contact">Become a design partner</ButtonLink>
        </div>
      </Block>
    </PageShell>
  );
}
