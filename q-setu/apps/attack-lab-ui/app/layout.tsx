import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Nav } from "../lib/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "Attack Lab · QuantumLedger",
  description:
    "Recorded attacks on the protected sandbox: signed evidence, timelines, patterns and replays.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        {/* The main site's tokens, served as they are (see app/tokens.css/route.ts). */}
        <link rel="stylesheet" href="/tokens.css" />
        <link rel="icon" href="data:," />
      </head>
      <body>
        <Nav />
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
