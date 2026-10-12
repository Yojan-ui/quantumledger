import { Block, Lines, PageHero, PageShell } from "@/components/ui";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Changelog",
  description: "What changed in QuantumLedger, release by release.",
  path: "/changelog",
});

const RELEASES: { version: string; date: string; items: string[] }[] = [
  {
    version: "0.3",
    date: "October 2026",
    items: [
      "“Is your bank quantum-safe?”: live URL scans with a score, plain-language findings and shareable results",
      "Drizzle persistence: SQLite locally, Postgres in production; KMS keys stored with the ledger",
      "Developer docs, pricing, security and company pages; ⌘K command menu; presenter and offline modes",
    ],
  },
  {
    version: "0.2",
    date: "October 2026",
    items: [
      "Live event bus, metrics and the live mesh behind the ticker and the globe",
      "Proof Chain: a SHA3-256 hash chain signed with ML-DSA-65, with tamper detection",
      "URL readiness scan, migration planner, policy hot-swap and a demo KMS",
    ],
  },
  {
    version: "0.1",
    date: "October 2026",
    items: ["Core, five adapters, three demos and the readiness scanner"],
  },
];

export default function Changelog() {
  return (
    <PageShell>
      <PageHero label="Changelog" title="What changed, release by release." />
      {RELEASES.map((r) => (
        <Block key={r.version} label={r.date} title={`Version ${r.version}`}>
          <Lines items={r.items} />
        </Block>
      ))}
    </PageShell>
  );
}
