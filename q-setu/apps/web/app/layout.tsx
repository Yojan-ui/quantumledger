import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import Script from "next/script";
import { CommandMenu } from "@/components/ui/CommandMenu";
import { Interactions } from "@/components/ui/Interactions";
import { Warmup } from "@/components/ui/Warmup";
import { Presenter } from "@/components/present/Presenter";
import { GlobeTooltip } from "@/components/world/GlobeTooltip";
import { LiveTraffic } from "@/components/world/LiveTraffic";
import { RouteSync } from "@/components/world/RouteSync";
import { WorldCanvas } from "@/components/world/WorldCanvas";
import { serverToken } from "@/lib/brand/tokens-server";
import { COPY_MODE_SCRIPT } from "@/lib/copy-mode-script";
import { SITE_NAME, SITE_URL } from "@/lib/meta";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Q-Setu: make anything in India quantum-safe, in one line",
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "Q-Setu adds NIST post-quantum encryption and signatures (ML-KEM, FIPS 203; ML-DSA, FIPS 204) to any website, server, app or device in one line.",
  applicationName: SITE_NAME,
};

export const viewport: Viewport = { themeColor: serverToken("--bg"), colorScheme: "dark" };

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/brand/q-setu-mark.svg`,
      description: "Quantum-safe India before Q-Day.",
    },
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "SecurityApplication",
      operatingSystem: "Linux, macOS, Windows, browsers",
      url: SITE_URL,
      description:
        "A post-quantum security layer: hybrid X25519 + ML-KEM-768 key exchange and ML-DSA signatures for any website, server, app, device or database.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "INR",
        description: "Community edition (self-hosted)",
      },
    },
  ],
};

// No third-party script at all in offline demo mode.
const PLAUSIBLE =
  process.env.NEXT_PUBLIC_OFFLINE === "1" ? undefined : process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Simple / Technical copy, applied before first paint (no flash of the other version). */}
        <script dangerouslySetInnerHTML={{ __html: COPY_MODE_SCRIPT }} />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {PLAUSIBLE && (
          <Script
            defer
            data-domain={PLAUSIBLE}
            src={
              process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ??
              "https://plausible.io/js/script.tagged-events.js"
            }
            strategy="afterInteractive"
          />
        )}
        {/* One world for the whole site; it only ever draws inside a page's [data-world-focus] area. */}
        <WorldCanvas />
        <RouteSync />
        <LiveTraffic />
        <Interactions />
        <Warmup />
        <GlobeTooltip />
        <CommandMenu />
        <Presenter />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
