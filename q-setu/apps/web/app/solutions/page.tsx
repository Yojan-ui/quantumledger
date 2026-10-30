import Link from "next/link";
import { Container, Heading, PageHero, PageShell, Text } from "@/components/ui";
import { SOLUTIONS } from "@/data/solutions";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Solutions",
  description: "Where QuantumLedger fits in Indian banking and fintech.",
  path: "/solutions",
});

export default function Solutions() {
  return (
    <PageShell>
      <PageHero
        label="Solutions"
        title="Built for India’s most sensitive rails."
        lead="Each sector keeps data that must stay private, or provable, for decades."
        globe
      />
      <Container className="py-16 md:py-24">
        <ul className="border-b border-line">
          {SOLUTIONS.map((s) => (
            <li key={s.id} className="border-t border-line">
              <Link
                href={`/solutions/${s.id}`}
                className="group grid grid-cols-12 gap-x-6 gap-y-2 py-8"
              >
                <Heading as="h2" variant="h2" className="col-span-12 md:col-span-3">
                  {s.name}
                </Heading>
                <Text className="col-span-12 md:col-span-7">{s.problem}</Text>
                <span className="col-span-12 self-center text-small text-fg-3 transition-colors duration-150 group-hover:text-fg md:col-span-2 md:text-right">
                  Open →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </PageShell>
  );
}
