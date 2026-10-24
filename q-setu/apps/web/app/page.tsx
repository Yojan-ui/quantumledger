import type { Metadata } from "next";
import { Analogy } from "@/components/home/Analogy";
import { Chapter, ChapterHead, ChapterIndex } from "@/components/home/ChapterIndex";
import { DeviceSeal } from "@/components/home/DeviceSeal";
import { EarlyAccess } from "@/components/home/EarlyAccess";
import { Hero, JoinLive } from "@/components/home/Hero";
import { HomeWorkflow } from "@/components/home/HomeWorkflow";
import { Impact } from "@/components/home/Impact";
import { IndexSection } from "@/components/home/IndexSection";
import { ScanSite } from "@/components/home/ScanSite";
import { Adapters, Solutions, WhyQSetu } from "@/components/home/Sections";
import { Story } from "@/components/home/Story";
import { WhatsNew } from "@/components/home/WhatsNew";
import { ZeroTrustStrip } from "@/components/trust/HeroTrust";
import { TrustRail } from "@/components/trust/TrustRail";
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
 * The 13 sections for a first-time visitor, in four chapters (components/home/ChapterIndex): the problem
 * (hero, analogy, impact), how it works (scan, story, adapters, device seal), proof (join live, the
 * Readiness Index, what's new), and who it's for (solutions, why QuantumLedger, early access).
 * Section labels are numbered within their chapter.
 */
export default function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        <Chapter id="problem" overlay>
          <Hero />
          <HomeWorkflow />
          <ChapterHead id="problem" className="lg:hidden" />
          <ZeroTrustStrip />
          <Analogy index="1.2" />
          <Impact index="1.3" />
        </Chapter>
        <Chapter id="how">
          <ScanSite />
          <Story index="2.2" />
          <Adapters index="2.3" />
          <DeviceSeal />
        </Chapter>
        <Chapter id="proof">
          <JoinLive />
          <IndexSection index="3.2" />
          <WhatsNew index="3.3" />
        </Chapter>
        <Chapter id="start">
          <Solutions index="4.1" />
          <WhyQSetu index="4.2" />
          <EarlyAccess index="4.3" />
        </Chapter>
      </main>
      <Footer />
      <ChapterIndex />
      <TrustRail />
    </>
  );
}
