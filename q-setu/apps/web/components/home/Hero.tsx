"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { LiveStrip } from "@/components/live/LiveStrip";
import { RoomFeed } from "@/components/room/RoomFeed";
import { Button, ButtonLink, Container, Legend, SectionLabel, Text } from "@/components/ui";
import { HeroInput, HeroStage, HeroStatus, useHeadlineBeat } from "./HeroStage";
import { startTour } from "@/components/tour/Tour";
import { Copy } from "@/components/ui/Copy";
import { world } from "@/components/world/store";
import { HERO } from "./chapters";

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

  const lines = HERO.title.split(/(?<=\.)\s+/);
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
            <span aria-hidden data-beat={beat} className="block">
              <span data-line="1" className="block">
                {lines[0]}
              </span>
              <span data-line="2" className="inline-block">
                {lines[1]}
              </span>{" "}
              <span data-line="3" className="inline-block">
                {lines[2]}
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
      {/* Without JavaScript every line shows (the beats are a script-driven reveal). */}
      <noscript>
        <style>{`[data-beat] [data-line]{opacity:1!important;transform:none!important}`}</style>
      </noscript>
    </section>
  );
}

/** Join live from your phone: the room QR, the counter and the globe its arcs land on. */
export function JoinLive() {
  useEffect(() => {
    const el = document.getElementById("join-live");
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        world.chapter = 0;
        world.accent = "accent";
        world.glow = "kem";
      },
      { threshold: 0.3 },
    );
    if (el) io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section id="join-live" className="relative scroll-mt-14 py-16 md:py-24" aria-label="Join live">
      <Container className="grid grid-cols-12 items-center gap-x-6 gap-y-8">
        <div className="col-span-12 md:col-span-6">
          <SectionLabel label="Join live" role="kem" />
          <p className="max-w-text text-h2 font-medium text-fg">
            Seal a message from your phone and watch it land on the globe.
          </p>
          <div className="mt-8">
            <RoomQR className="hidden md:flex" />
            <ButtonLink href="/join" variant="secondary" className="md:hidden">
              Join live on this phone
            </ButtonLink>
            <RoomFeed className="mt-5" />
          </div>
        </div>
        <div className="relative col-span-12 md:col-span-6">
          <div data-world-focus data-world-drag className="h-globe md:h-stage" aria-hidden />
          <Legend align="right" className="absolute bottom-0 left-0 md:-bottom-4" />
        </div>
      </Container>
    </section>
  );
}
