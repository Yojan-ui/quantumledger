import type { Metadata } from "next";
import { ADAPTERS } from "@/components/home/chapters";
import { Code, Grid, Heading, Label, Section, Text, TextLink } from "@/components/ui";
import { Footer } from "@/components/ui/Footer";
import { Nav } from "@/components/ui/Nav";

export const metadata: Metadata = { title: "Docs · Q-Setu" };

const DETAIL: Record<string, { body: string; code: string }> = {
  shield: {
    body: "Run one node next to the app and one next to its callers. Traffic between them is a hybrid PQC session; the app is untouched.",
    code: "npx qsetu-shield --upstream http://localhost:4000 --listen 8443\nnpx qsetu-shield --peer http://bank-dc:8443 --listen 8080",
  },
  web: {
    body: "Seals fetch bodies and form posts in the browser, pins the server key and verifies signed replies.",
    code: '<script src="/qsetu.js" data-key="<server key id>" data-endpoint="/api/"></script>',
  },
  sdk: {
    body: "Sessions for chatty traffic, one-shot envelopes for messages, detached ML-DSA signatures.",
    code: 'import { createSession, seal, open, sign, verify } from "@qsetu/sdk";\nconst s = await createSession({ url: "/qsetu", serverKey });\nawait s.send({ amountINR: "500.00" });',
  },
  edge: {
    body: "One handshake, then AES-GCM readings; batches are hash-chained and signed with ML-DSA-44.",
    code: 'new EdgeDevice("meter-17", deviceKey, gatewayKey, { ramBytes: 65_536, cpuSlowdown: 20 });',
  },
  vault: {
    body: "Per-record AES keys wrapped with ML-KEM, records signed with ML-DSA, rotation without re-encryption.",
    code: "const vault = createVault({ keys });\nconst { id } = await vault.put(labReport);\nawait vault.get(id);",
  },
};

export default function Docs() {
  return (
    <>
      <Nav />
      <main id="main">
        <Section label="Docs">
          <Heading as="h1" className="max-w-text">
            One core. Five adapters.
          </Heading>
          <Text className="mt-4 max-w-text">
            Every adapter uses the same registry:{" "}
            <span className="font-mono text-fg">standard</span> (X25519 + ML-KEM-768, ML-DSA-65) or{" "}
            <span className="font-mono text-fg">edge</span> (X25519 + ML-KEM-512, ML-DSA-44).
          </Text>
          <div className="mt-16 border-b border-line">
            {ADAPTERS.map((a, i) => (
              <Grid key={a.id} className="scroll-mt-24 gap-y-4 border-t border-line py-12">
                <div id={a.id} className="col-span-12 md:col-span-4">
                  <Label>{String(i + 1).padStart(2, "0")}</Label>
                  <Heading as="h2" variant="h2" className="mt-2">
                    Q-Setu {a.name}
                  </Heading>
                  <Text size="small" className="mt-2">
                    {DETAIL[a.id]!.body}
                  </Text>
                </div>
                <div className="col-span-12 md:col-span-8">
                  <Code code={DETAIL[a.id]!.code}>{DETAIL[a.id]!.code}</Code>
                </div>
              </Grid>
            ))}
          </div>
          <div className="mt-8">
            <TextLink href="/demo">Run the demos →</TextLink>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
