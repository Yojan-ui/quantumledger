"use client";

import dynamic from "next/dynamic";
import { chunkFailed } from "@/lib/client/chunk";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LiveStrip } from "@/components/live/LiveStrip";
import { RoomFeed } from "@/components/room/RoomFeed";
import { Button, ButtonLink, Container, Legend, SectionLabel, Text } from "@/components/ui";
import { HeroInput, HeroStatus, useHeadlineBeat } from "./HeroStage";
import { useJourney } from "@/lib/client/journey";
import { startTour } from "@/components/tour/Tour";
import { Copy } from "@/components/ui/Copy";
import { world } from "@/components/world/store";
import { scrollToY } from "@/lib/client/scroll";
import { HERO } from "./chapters";
import { HeroTrust } from "@/components/trust/HeroTrust";
import { SealedText, sealedClass, sealedLine, useSealed } from "@/components/trust/Sealed";
import { HERO_LINES } from "@/lib/trust/headlines";

/**
 * One sentence of the headline: sealed until its beat lands, then verified and decrypted. An invisible
 * copy of the plain words holds the line's size, and the sealed layer sits in the same cell, clipped
 * to it: ciphertext doesn't wrap, so without this a wrapped line would collapse and re-grow (layout
 * shift; the hero is anchored to the bottom, so the whole block would jump).
 */
function HeroLine({ text, visible }: { text: string; visible: boolean }) {
  const v = useSealed(text, visible);
  return (
    <span className="inline-grid max-w-full">
      <span className="invisible" style={{ gridArea: "1 / 1" }}>
        {text}
      </span>
      <span className={`min-w-0 overflow-hidden ${sealedClass(v)}`} style={{ gridArea: "1 / 1" }}>
        {sealedLine(text, 0, text.length, v)}
      </span>
    </span>
  );
}

// The hero 3D stage (and three.js with it) mounts after the first paint, so the headline, copy and
// buttons never wait for it; until then the page's own dark background shows in its place.
const HeroStage = dynamic(
  () =>
    import("./HeroStage")
      .catch(() => import("./HeroStage"))
      .then((m) => m.HeroStage)
      .catch(chunkFailed),
  { ssr: false },
);

/** Renders its children only after the browser has painted the page once. */
function AfterPaint({ children }: { children: ReactNode }) {
  const [painted, setPainted] = useState(false);
  useEffect(() => {
    let b = 0;
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setPainted(true));
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, []);
  return painted ? children : null;
}

// The QR encoder loads after first paint; the hero's text never waits for it.
const RoomQR = dynamic(
  () =>
    import("@/components/room/RoomQR")
      .catch(() => import("@/components/room/RoomQR"))
      .then((m) => m.RoomQR)
      .catch(chunkFailed),
  {
    ssr: false,
    loading: () => <div className="hidden h-32 md:block" aria-hidden />,
  },
);

/** The hero's third button: down to "Scan any site" (ScanSite), under the sticky nav. */
function scrollToScan() {
  const el = document.getElementById("scan");
  if (el) scrollToY(el.getBoundingClientRect().top + window.scrollY - 56);
}

/**
 * The hero is the 3D, edge to edge: the real diagnostics stage runs the opening (a real key pair, the
 * particle mark bursting into the swarm, then the five stages on the cached example in ~9 s). The
 * headline sits over it bottom-left; its three sentences land with the stages (see HeroStage). The
 * full sentence is server-rendered for readers and crawlers; the visible lines are aria-hidden.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const beat = useHeadlineBeat();
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        world.chapter = 0;
        world.accent = "accent";
        world.glow = "kem";
      },
      { threshold: 0.3 },
    );
    if (ref.current) io.observe(ref.current);
    world.chapter = 0;
    world.accent = "accent";
    return () => io.disconnect();
  }, []);

  const lines = HERO_LINES;
  return (
    <section
      ref={ref}
      id="top"
      className="relative h-hero min-h-hero overflow-hidden"
      aria-label="QuantumLedger"
    >
      <AfterPaint>
        <HeroStage />
      </AfterPaint>
      <div className="hero-scrim pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative">
        <LiveStrip />
      </div>
      <Container className="pointer-events-none relative h-full">
        <div className="absolute right-5 top-6 md:right-8">
          <HeroStatus />
        </div>
        <div data-hero className="absolute inset-x-5 bottom-8 md:inset-x-8 md:bottom-16">
          <h1 className="max-w-container text-hero font-medium text-fg">
            <span className="sr-only">{HERO.title.replace(/‑/g, "-")}</span>
            <span aria-hidden data-beat={beat} data-seal-text className="block">
              <span data-line="1" className="block">
                <HeroLine text={lines[0]!} visible />
              </span>
              <span data-line="2" className="inline-block">
                <HeroLine text={lines[1]!} visible={beat >= 2} />
              </span>{" "}
              <span data-line="3" className="inline-block">
                <HeroLine text={lines[2]!} visible={beat >= 3} />
              </span>
            </span>
          </h1>
          <Text className="mt-6 max-w-text">
            <Copy simple={HERO.body} technical={HERO.technical} />
          </Text>
          <div className="pointer-events-auto mt-8 flex flex-col items-start gap-4">
            <HeroInput />
            <p className="max-w-text text-small text-fg md:text-body">
              Scan your website, protect it with one DNS change, and get proof it&apos;s
              quantum-safe.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" onClick={startTour} data-tour-start>
                Take the 3-minute tour
              </Button>
              <ButtonLink href="/diagnostics" variant="secondary">
                Open full diagnostics
              </ButtonLink>
              <Button variant="secondary" onClick={scrollToScan}>
                Scan your website
              </Button>
            </div>
          </div>
        </div>
      </Container>
      <HeroTrust />
      {/* Without JavaScript every line shows (the beats are a script-driven reveal). */}
      <noscript>
        <style>{`[data-beat] [data-line]{opacity:1!important;transform:none!important}`}</style>
      </noscript>
    </section>
  );
}

/**
 * Join live from your phone. Full bleed: the camera starts close on one node (where the hero's sphere
 * sat) and pulls back as you scroll, revealing it as one point on the globe; phone-sealed messages
 * arrive as arcs. The statement is centred over the 3D, the QR card sits at the bottom.
 */
export function JoinLive() {
  const ref = useRef<HTMLElement>(null);
  useJourney(ref, 0, 1);
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        world.chapter = 0;
        world.accent = "accent";
        world.glow = "kem";
      },
      { threshold: 0.3 },
    );
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <section
      ref={ref}
      id="join-live"
      className="relative min-h-svh scroll-mt-14 overflow-hidden"
      aria-label="Join live"
    >
      <div data-world-focus data-world-drag className="absolute inset-0" aria-hidden />
      <Container className="pointer-events-none relative flex min-h-svh flex-col items-center justify-between py-24 text-center">
        <div className="flex flex-col items-center">
          <SectionLabel label="Join live" role="kem" />
          <p className="max-w-text text-h1-sm font-medium text-fg md:text-display">
            <SealedText text="Seal a message from your phone. Watch it land here." />
          </p>
        </div>
        <div className="pointer-events-auto flex flex-col items-center gap-4 border border-line bg-base p-5">
          <RoomQR className="hidden md:flex" />
          <ButtonLink href="/join" variant="secondary" className="md:hidden">
            Join live on this phone
          </ButtonLink>
          <RoomFeed />
        </div>
      </Container>
      <Legend className="absolute bottom-6 left-5 md:left-8" />
    </section>
  );
}
