import {
  Block,
  ButtonLink,
  Container,
  Grid,
  Heading,
  Label,
  PageHero,
  PageShell,
  Text,
} from "@/components/ui";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Pricing",
  description:
    "Community (free, self-hosted), Pro (managed Shield and Proof Chain) and Government & Enterprise (on-prem, HSM).",
  path: "/pricing",
});

const TIERS = [
  {
    name: "Community",
    price: "Free",
    note: "Open-source core (licence to be announced), self-hosted",
    items: [
      "Core, five adapters, scanner",
      "Self-host on your infrastructure",
      "Community support",
    ],
    cta: ["Read the quickstart", "/docs"],
  },
  {
    name: "Pro",
    price: "₹ — contact us",
    note: "Pricing not decided yet",
    items: [
      "Managed Shield nodes",
      "Hosted Proof Chain with retention",
      "Migration planning and support",
    ],
    cta: ["Talk to us", "/contact"],
  },
  {
    name: "Government & Enterprise",
    price: "Contact",
    note: "For regulated and critical systems",
    items: ["On-prem deployment", "HSM-backed keys (PKCS#11)", "Compliance and audit support"],
    cta: ["Talk to us", "/contact"],
  },
] as const;

const FAQ: [string, string][] = [
  [
    "Is the core open source?",
    "That’s the plan: the core, the five adapters and the scanner will be published under an open-source licence (not chosen yet). Pro and Enterprise add managed operation, hosting and support, not secret cryptography.",
  ],
  [
    "Why isn’t there a Pro price?",
    "We haven’t set one. We would rather price with our first design partners than publish a number we’d change.",
  ],
  [
    "Has QuantumLedger been audited?",
    "Not yet. It builds on @noble libraries; three of the four have independent audits, the post-quantum one is self-audited. Details are on the security page.",
  ],
  [
    "Does it replace TLS?",
    "No. It adds a hybrid post-quantum layer where TLS can’t be upgraded quickly (legacy cores, internal links, stored data) and signs what must stay provable.",
  ],
];

export default function Pricing() {
  return (
    <PageShell>
      <PageHero
        label="Pricing"
        title="Start free. Pay when we run it for you."
        lead="The cryptography is the same in every tier. What changes is who operates it."
      />
      <Container className="py-10 md:py-15 lg:py-20">
        <Grid className="gap-y-6">
          {TIERS.map((t, i) => (
            // Three equal-height cards, the same inner padding; the border brightens on hover.
            <section
              key={t.name}
              className="col-span-12 flex flex-col rounded-sm border border-line p-6 transition-colors duration-150 hover:border-line-strong md:col-span-4 md:p-8"
            >
              <Heading as="h2" variant="h3">
                {t.name}
              </Heading>
              <p className="tabular mt-4 text-h2 font-medium text-fg">{t.price}</p>
              <Label as="p" className="mt-1">
                {t.note}
              </Label>
              <ul className="mt-6 flex-1 space-y-2">
                {t.items.map((it) => (
                  <li key={it} className="text-small text-fg-2">
                    {it}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <ButtonLink href={t.cta[1]} variant={i === 0 ? "primary" : "secondary"}>
                  {t.cta[0]}
                </ButtonLink>
              </div>
            </section>
          ))}
        </Grid>
      </Container>
      <Block label="FAQ" title="Questions we get.">
        <div className="border-b border-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group border-t border-line py-4">
              <summary className="cursor-pointer list-none text-body text-fg">
                <span className="mr-3 font-mono text-fg-3 group-open:hidden">+</span>
                <span className="mr-3 hidden font-mono text-fg-3 group-open:inline">–</span>
                {q}
              </summary>
              <Text className="mt-2 pl-6">{a}</Text>
            </details>
          ))}
        </div>
      </Block>
    </PageShell>
  );
}
