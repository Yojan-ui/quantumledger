import type { Metadata } from "next";
import { Analogy } from "@/components/home/Analogy";
import { DeviceSeal } from "@/components/home/DeviceSeal";
import { EarlyAccess } from "@/components/home/EarlyAccess";
import { Hero, JoinLive } from "@/components/home/Hero";
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
  title: "QuantumLedger: see your quantum risk. Fix it. Prove it.",
  description:
    "QuantumLedger scans, upgrades and signs your systems with NIST post-quantum cryptography. Scan any site, apply a hybrid ML-KEM patch, and anchor the proof in a signed chain.",
  path: "/",
  absoluteTitle: true,
});

/**
 * Ten sections for a first-time visitor: hero, the analogy, the Readiness Index (with the scan box),
 * how it works, deploy anywhere, solutions, impact, what's new, why QuantumLedger, early access.
 */
export default function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <JoinLive />
        <Analogy index="02" />
        <IndexSection index="03" />
        <ScanSite />
        <Story />
        <Adapters />
        <Solutions />
        <Impact index="07" />
        <DeviceSeal />
        <WhatsNew index="08" />
        <WhyQSetu />
        <EarlyAccess />
      </main>
      <Footer />
    </>
  );
}
