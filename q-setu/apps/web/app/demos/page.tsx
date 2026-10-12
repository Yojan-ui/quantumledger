import type { Metadata } from "next";
import Link from "next/link";
import { DemoPanels } from "@/components/demos/DemoPanels";
import { Heading, Section, Text } from "@/components/ui";
import { Footer } from "@/components/ui/Footer";
import { Nav } from "@/components/ui/Nav";
import { pageMeta } from "@/lib/meta";

export const metadata: Metadata = pageMeta({
  title: "Demos",
  description:
    "Four live demos of QuantumLedger: a real hybrid handshake, deploying five adapters, the Q-Day time machine and a tamper-evident ledger.",
  path: "/demos",
});

const TOOLS = [
  {
    href: "/demo/scanner",
    title: "Quantum Readiness Scanner",
    body: "Score a config, certificate, code or live website. Export a CBOM.",
  },
  {
    href: "/web-shield-demo/",
    title: "A plain HTML form, made quantum-safe",
    body: "View source: the only change is one script tag.",
  },
];

export default function DemoHub() {
  return (
    <>
      <Nav />
      <main id="main">
        <Section label="Demos">
          <Heading as="h1" className="max-w-text">
            Real crypto. No slides.
          </Heading>
          <Text className="mt-4 max-w-text">
            Every packet, key and number below is produced live, in your browser or on this server.
          </Text>
          <div className="mt-12">
            <DemoPanels />
          </div>
          <ul className="mt-16 border-b border-line">
            {TOOLS.map((t) => (
              <li key={t.href} className="border-t border-line">
                <Link
                  href={t.href}
                  className="group flex items-baseline justify-between gap-6 py-6"
                >
                  <span>
                    <span className="block text-h3 font-medium text-fg">{t.title}</span>
                    <span className="mt-1 block text-small text-fg-2">{t.body}</span>
                  </span>
                  <span className="text-small text-fg-3 transition-colors duration-150 group-hover:text-fg">
                    Open →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </main>
      <Footer />
    </>
  );
}
