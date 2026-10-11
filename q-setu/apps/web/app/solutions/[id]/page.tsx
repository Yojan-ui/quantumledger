import { notFound } from "next/navigation";
import { Workflow } from "@/components/solutions/Workflow";
import {
  Block,
  ButtonLink,
  Container,
  Label,
  Lines,
  PageHero,
  PageShell,
  TextLink,
} from "@/components/ui";
import { SOLUTIONS, solution } from "@/data/solutions";
import { pageMeta } from "@/lib/meta";

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return SOLUTIONS.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: Props) {
  const s = solution((await params).id);
  if (!s) return {};
  return pageMeta({
    title: `${s.name}: quantum-safe`,
    description: s.problem,
    path: `/solutions/${s.id}`,
    label: `Solutions · ${s.name}`,
  });
}

export default async function SolutionPage({ params }: Props) {
  const s = solution((await params).id);
  if (!s) notFound();
  return (
    <PageShell>
      <PageHero label={`Solutions · ${s.name}`} title={s.problem} globe>
        <div className="flex flex-wrap items-center gap-6">
          <ButtonLink href={s.demo.href}>{s.demo.label}</ButtonLink>
          <TextLink href="/#early-access">Become a design partner →</TextLink>
        </div>
        <p className="mt-6 font-mono text-label uppercase text-fg-3">
          Data lifetime · {s.dataLifetime}
        </p>
      </PageHero>
      <section className="border-b border-line py-16 md:py-24">
        <Container>
          <Label className="mb-6 block">Workflow</Label>
          <Workflow s={s} />
        </Container>
      </section>
      <Block label="ML-KEM · FIPS 203" title="Keeps it secret.">
        <Lines items={s.kem} />
      </Block>
      <Block label="ML-DSA · FIPS 204" title="Keeps it provable.">
        <Lines items={s.dsa} />
      </Block>
      <Block label="Without vs with" title="What changes.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-panel text-left">
            <caption className="sr-only">{s.name} without and with Q-Setu</caption>
            <thead>
              <tr className="border-b border-line">
                <th className="w-1/4 pb-3">
                  <span className="sr-only">Aspect</span>
                </th>
                <Label as="th" className="pb-3 pr-4 font-normal">
                  Without Q-Setu
                </Label>
                <Label as="th" className="pb-3 font-normal">
                  With Q-Setu
                </Label>
              </tr>
            </thead>
            <tbody>
              {s.without.map(([k, v]) => (
                <tr key={k} className="border-b border-line align-top">
                  <th scope="row" className="py-4 pr-4 text-left text-body font-normal text-fg">
                    {k}
                  </th>
                  <td className="py-4 pr-4 text-body text-fg-2">
                    <span className="mr-2 text-warn" aria-hidden>
                      ●
                    </span>
                    {v}
                  </td>
                  <td className="py-4 text-body text-fg-2">
                    <span className="mr-2 text-accent" aria-hidden>
                      ●
                    </span>
                    {k === "Migration" || k === "Inventory"
                      ? "One adapter per system; the scanner maps what’s left"
                      : "Sealed or signed with NIST post-quantum algorithms"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>
      <Block label="Honest scope" title="What exists today.">
        <p>
          The {s.name.toLowerCase()} flows in our demos are modelled on public Indian systems, with
          fictional institutions and people. Q-Setu is not integrated with any live national system.
          We are looking for design partners to pilot it in shadow mode.
        </p>
      </Block>
    </PageShell>
  );
}
