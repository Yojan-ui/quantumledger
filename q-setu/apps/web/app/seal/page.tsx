import type { Metadata } from "next";
import { ButtonLink, Container, SectionLabel } from "@/components/ui";
import { Footer } from "@/components/ui/Footer";
import { Nav } from "@/components/ui/Nav";
import { parseSealShare, sealLine } from "@/lib/seal-share";

type Search = Promise<{ ms?: string; on?: string }>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Search;
}): Promise<Metadata> {
  const { ms, on } = parseSealShare(await searchParams);
  const title = ms ? sealLine(ms, on) : "A post-quantum handshake on your device";
  const og = `/og/seal?${ms ? `ms=${ms}&` : ""}on=${on}`;
  return {
    title,
    description: "ML-KEM-768 (FIPS 203), run and timed in the browser with QuantumLedger.",
    openGraph: { title, images: [{ url: og, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, images: [og] },
    robots: { index: false },
  };
}

/** /seal?ms=&on=: a shared result. The number was measured in the sharer's browser. */
export default async function SealShare({ searchParams }: { searchParams: Search }) {
  const { ms, on } = parseSealShare(await searchParams);
  return (
    <>
      <Nav />
      <main id="main">
        <Container className="py-24 md:py-40">
          <SectionLabel label="Post-quantum, on a real device" role="kem" />
          <h1 className="max-w-container text-h1-sm font-medium text-fg md:text-display">
            {ms ? sealLine(ms, on) : "Run a post-quantum handshake on your device."}
          </h1>
          <p className="mt-6 max-w-text text-body text-fg-2">
            ML-KEM-768 (FIPS 203): key generation, encapsulation and decapsulation, the median of
            five runs, measured in the sharer&apos;s browser. Try it on yours: it takes a moment and
            nothing leaves your tab.
          </p>
          <div className="mt-10">
            <ButtonLink href="/#device">Try it on this device</ButtonLink>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
