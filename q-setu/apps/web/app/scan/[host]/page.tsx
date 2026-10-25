import type { Metadata } from "next";
import { ScanPage } from "@/components/scan/ScanPage";
import { Container, Label } from "@/components/ui";
import { Footer } from "@/components/ui/Footer";
import { Breadcrumb, NextStep, PagePurpose } from "@/components/ui/Wayfinding";
import { Nav } from "@/components/ui/Nav";
import { pageMeta } from "@/lib/meta";
import type { ScanView } from "@/lib/scan-types";
import { storedScan } from "@/lib/server/scan-lookup";
import { safeDecode } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ host: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const host = safeDecode((await params).host).slice(0, 120);
  const r = await storedScan(host);
  const meta = pageMeta({
    title: `Is ${host} quantum-safe?`,
    description: r
      ? `${host} scored ${r.score}/100 on QuantumLedger's quantum-readiness scan: ${r.probe.hybridPq ? "hybrid post-quantum key exchange" : "classical key exchange, harvestable today"}.`
      : `Scan ${host} for quantum risk with QuantumLedger.`,
    path: `/scan/${encodeURIComponent(host)}`,
  });
  // This page has its own score card image (opengraph-image.tsx).
  delete meta.openGraph?.images;
  delete meta.twitter;
  return meta;
}

export default async function Page({ params }: Props) {
  const host = safeDecode((await params).host).slice(0, 253);
  const r = await storedScan(host);
  return (
    <>
      <Nav />
      <main id="main">
        <Container className="py-24 md:py-32">
          <Breadcrumb className="mb-6" />
          <Label>Quantum-readiness scan</Label>
          <h1 className="mt-4 max-w-text break-words text-h1-sm font-medium text-fg md:text-h1">
            Is {host} quantum-safe?
          </h1>
          <PagePurpose className="mt-3" />
          <div className="mt-12 max-w-text">
            <ScanPage host={host} initial={r as unknown as ScanView | undefined} />
          </div>
        </Container>
      </main>
      <NextStep />
      <Footer />
    </>
  );
}
