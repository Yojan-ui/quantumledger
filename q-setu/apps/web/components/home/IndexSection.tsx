import { ReadinessBars } from "@/components/index/ReadinessIndex";
import { Container, SectionLabel, TextLink } from "@/components/ui";
import { MaskHeading } from "@/components/ui/MaskHeading";
import { pct, READINESS, share } from "@/lib/readiness";

/** Home: the India Quantum Readiness Index (sector totals, bars rising out of India). */
export function IndexSection({ index }: { index: string }) {
  const all = READINESS.all;
  // Headlines come from the measured totals, so they can never drift from the data.
  const classical = pct(1 - share(all, "hybridPq"));
  return (
    <section id="index" className="relative scroll-mt-14 py-24 md:py-40">
      <Container>
        <SectionLabel index={index} label="India Quantum Readiness Index" role="ok" />
        <div data-copy="simple">
          <MaskHeading
            text={`${classical} of the Indian sites we checked still use a lock a quantum computer could open.`}
          />
        </div>
        <div data-copy="technical">
          <MaskHeading
            text={`${pct(share(all, "hybridPq"))} negotiate hybrid ML-KEM. ${pct(share(all, "rsa2048"))} still present RSA-2048 certificates.`}
          />
        </div>
        <ReadinessBars className="mt-12" />
        <div className="mt-8">
          <TextLink href="/index">The full index and how it was measured →</TextLink>
        </div>
      </Container>
    </section>
  );
}
