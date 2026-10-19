import type { Metadata } from "next";
import { ReadinessBars } from "@/components/index/ReadinessIndex";
import { Container, Heading, Label, Text } from "@/components/ui";
import { Footer } from "@/components/ui/Footer";
import { Breadcrumb, NextStep, PagePurpose } from "@/components/ui/Wayfinding";
import { Nav } from "@/components/ui/Nav";
import { pageMeta } from "@/lib/meta";
import { READINESS } from "@/lib/readiness";

export const metadata: Metadata = pageMeta({
  title: "India Quantum Readiness Index",
  description:
    "How many public Indian banking, government, healthcare, education and telecom sites already negotiate post-quantum key exchange. Sector totals from one public TLS handshake per site.",
  path: "/index",
});

const fmt = (iso: string) =>
  iso ? new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "–";

export default function IndexPage() {
  const all = READINESS.all;
  return (
    <>
      <Nav />
      <main id="main">
        <section className="pb-24 pt-16 md:pb-40 md:pt-24">
          <Container>
            <Breadcrumb className="mb-6" />
            <Label>India Quantum Readiness Index</Label>
            <Heading as="h1" variant="h1" className="mt-4 max-w-text">
              <span data-copy="simple">How ready are India&apos;s public websites?</span>
              <span data-copy="technical">Post-quantum TLS across India&apos;s public sites.</span>
            </Heading>
            <PagePurpose className="mt-3" />
            <Text className="mt-6 max-w-text">
              <span data-copy="simple">
                We connected once to {all.targets} public websites of Indian banks, government
                services, hospitals, universities and telecom companies, and noted which lock each
                one used. Here is the picture by sector.
              </span>
              <span data-copy="technical">
                One TLS handshake to each of {all.targets} public Indian domains in five sectors,
                recording the negotiated key-exchange group, TLS version and certificate key.
                Aggregated by sector.
              </span>
            </Text>
            <ReadinessBars className="mt-16" />
          </Container>
        </section>
        <section id="method" className="scroll-mt-14 border-t border-line py-24">
          <Container className="grid grid-cols-12 gap-x-6 gap-y-10">
            <div className="col-span-12 md:col-span-4">
              <Label>Methodology</Label>
            </div>
            <div className="col-span-12 space-y-4 md:col-span-8">
              <Text>{READINESS.method}</Text>
              <Text>
                The list is {all.targets} public domains chosen by hand from well-known Indian
                organisations ({Object.keys(READINESS.sectors).length} sectors), kept in{" "}
                <code className="font-mono text-small text-fg">data/readiness-targets.json</code>.
                It is not a random sample, so the shares describe this list, not every Indian site.
              </Text>
              <Text>
                “Hybrid post-quantum” means the server chose X25519MLKEM768 when we offered it. Many
                sites get this from their CDN rather than their own servers. A site that didn&apos;t
                answer within 6 seconds counts as unreachable and is left out of the shares (
                {all.targets - all.reachable} of {all.targets} this run).
              </Text>
              <Text>
                Run from {READINESS.client}, {fmt(READINESS.startedAt)} to{" "}
                {fmt(READINESS.finishedAt)}. Rebuild with{" "}
                <code className="font-mono text-small text-fg">pnpm index:build</code>.
              </Text>
              <Label as="p" className="pt-6">
                Disclaimer
              </Label>
              <Text>
                This reads only what every browser sees when it connects: no logins, no other ports,
                no vulnerability tests. A handshake shows how one public endpoint was configured on
                one day, not how secure an organisation is. Results are shown as sector totals only;
                we don&apos;t rank or name individual organisations. To check a specific site, use
                the scan box on the home page.
              </Text>
            </div>
          </Container>
        </section>
      </main>
      <NextStep />
      <Footer />
    </>
  );
}
