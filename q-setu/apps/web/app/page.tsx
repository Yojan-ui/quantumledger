import type { Metadata } from "next";
import { Analogy } from "@/components/home/Analogy";
import { EarlyAccess } from "@/components/home/EarlyAccess";
import { Hero } from "@/components/home/Hero";
import { Impact } from "@/components/home/Impact";
import { IndexSection } from "@/components/home/IndexSection";
import { Proof } from "@/components/home/Proof";
import { ScanSite } from "@/components/home/ScanSite";
import { Adapters, Solutions, WhyQSetu } from "@/components/home/Sections";
import { Story } from "@/components/home/Story";
import { WhyNow } from "@/components/home/WhyNow";
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

/** Nine sections, one question each. */
export default function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <Analogy index="01" />
        <ScanSite />
        <IndexSection index="02" />
        <WhyNow />
        <Story />
        <Adapters />
        <Solutions />
        <Proof />
        <Impact index="07" />
        <WhyQSetu />
        <EarlyAccess />
      </main>
      <Footer />
    </>
  );
}
