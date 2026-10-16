"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { LiveStrip } from "@/components/live/LiveStrip";
import { RoomFeed } from "@/components/room/RoomFeed";
import { Button, ButtonLink, Container, Legend, SectionLabel, Text } from "@/components/ui";
import { HeroInput, HeroStage, HeroStatus, useHeadlineBeat } from "./HeroStage";
import { useJourney } from "@/lib/client/journey";
import { startTour } from "@/components/tour/Tour";
import { Copy } from "@/components/ui/Copy";
import { world } from "@/components/world/store";
import { HERO } from "./chapters";
import { HeroTrust } from "@/components/trust/HeroTrust";
import { SealedText, sealedClass, sealedLine, useSealed } from "@/components/trust/Sealed";
import { HERO_LINES } from "@/lib/trust/headlines";

/** One sentence of the headline: sealed until its beat lands, then verified and decrypted. */
function HeroLine({ text, visible }: { text: string; visible: boolean }) {
  const v = useSealed(text, visible);
  return <span className={sealedClass(v)}>{sealedLine(text, 0, text.length, v)}</span>;
}

// The QR encoder loads after first paint; the hero's text never waits for it.
const RoomQR = dynamic(() => import("@/components/room/RoomQR").then((m) => m.RoomQR), {
  ssr: false,
  loading: () => <div className="hidden h-32 md:block" aria-hidden />,
});

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
      <HeroStage />
      <div className="hero-scrim pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative">
        <LiveStrip />
      </div>
      <Container className="pointer-events-none relative h-full">
        <div className="absolute right-5 top-6 md:right-8">
          <HeroStatus />
        </div>
        <div data-hero className="absolute inset-x-5 bottom-24 md:inset-x-8 md:bottom-16">
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
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" onClick={startTour} data-tour-start>
                Take the 3-minute tour
              </Button>
              <ButtonLink href="/diagnostics" variant="secondary">
                Open full diagnostics
              </ButtonLink>
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
