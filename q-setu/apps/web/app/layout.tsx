import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Interactions } from "@/components/ui/Interactions";
import { GlobeTooltip } from "@/components/world/GlobeTooltip";
import { LiveTraffic } from "@/components/world/LiveTraffic";
import { RouteSync } from "@/components/world/RouteSync";
import { WorldCanvas } from "@/components/world/WorldCanvas";
import "./globals.css";

export const metadata: Metadata = {
  title: "Q-Setu: make anything in India quantum-safe, in one line",
  description:
    "Q-Setu adds NIST post-quantum encryption and signatures (ML-KEM, FIPS 203; ML-DSA, FIPS 204) to any website, server, app or device, with near-zero compute overhead.",
};

export const viewport: Viewport = { themeColor: "black" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        {/* One world for the whole site; it only ever draws inside a page's [data-world-focus] area. */}
        <WorldCanvas />
        <RouteSync />
        <LiveTraffic />
        <Interactions />
        <GlobeTooltip />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
