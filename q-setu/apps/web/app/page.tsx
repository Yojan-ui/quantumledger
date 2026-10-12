import type { Metadata } from "next";
import { Analogy } from "@/components/home/Analogy";
import { EarlyAccess } from "@/components/home/EarlyAccess";
import { Hero } from "@/components/home/Hero";
import { Impact } from "@/components/home/Impact";
import { IndexSection } from "@/components/home/IndexSection";
import { ScanSite } from "@/components/home/ScanSite";
import { Adapters, Solutions, WhyQSetu } from "@/components/home/Sections";
import { Story } from "@/components/home/Story";
import { WhatsNew } from "@/components/home/WhatsNew";
import { Footer } from "@/components/ui/Footer";
import { Nav } from "@/components/ui/Nav";
import { pageMeta } from "@/lib/meta";

export const metadata: Metadata = pageMeta({
  title: "Q-Setu: make anything in India quantum-safe, in one line",
  description:
    "Your data is being harvested today. Q-Setu adds NIST post-quantum encryption and signatures (ML-KEM, ML-DSA) to any website, server, app or device in one line, before Q-Day.",
  path: "/",
  absoluteTitle: true,
});

/**
 * Ten sections for a first-time visitor: hero, the analogy, the Readiness Index (with the scan box),
 * how it works, deploy anywhere, solutions, impact, what's new, why Q-Setu, early access.
 */
export default function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <Analogy index="02" />
        <IndexSection index="03" />
        <ScanSite />
        <Story />
        <Adapters />
        <Solutions />
        <Impact index="07" />
        <WhatsNew index="08" />
        <WhyQSetu />
        <EarlyAccess />
      </main>
      <Footer />
    </>
  );
}
