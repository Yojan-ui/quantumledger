"use client";

import dynamic from "next/dynamic";
import { Fragment, useEffect, useRef } from "react";
import { LiveStrip } from "@/components/live/LiveStrip";
import { RoomFeed } from "@/components/room/RoomFeed";
import { ButtonLink, Container, Legend, SectionLabel, Text } from "@/components/ui";
import { Copy } from "@/components/ui/Copy";
import { world } from "@/components/world/store";
import { HERO } from "./chapters";

// The QR encoder loads after first paint; the hero's text never waits for it.
const RoomQR = dynamic(() => import("@/components/room/RoomQR").then((m) => m.RoomQR), {
  ssr: false,
  loading: () => <div className="hidden h-32 md:block" aria-hidden />,
});

/**
 * The hero is the pitch: one headline, one subline, two buttons and the diagnostics HUD in compact
 * form. The headline is server-rendered and painted on the first frame; covers lift off it word by
 * word. JoinLive follows it: the phone QR and the globe the audience's packets land on.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
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

  const words = HERO.title.split(" ");
  return (
    <section ref={ref} id="top" className="relative flex flex-col" aria-label="QuantumLedger">
      <LiveStrip />
      <Container className="pb-4 pt-10 md:pt-10">
        <div data-hero className="grid grid-cols-12 items-end gap-x-6 gap-y-6">
          <h1 className="col-span-12 text-h1-sm font-medium text-fg md:col-span-7 md:text-h1">
            <span className="sr-only">{HERO.title.replace(/‑/g, "-")}</span>
            <span aria-hidden>
              {words.map((w, i) => (
                <Fragment key={i}>
                  <span className="relative -mb-2 inline-block overflow-hidden pb-2 align-top">
                    {w}
                    {/* The word is painted from the first frame (fast LCP); a --bg cover lifts off it. */}
                    <span
                      className="absolute inset-0 animate-uncover bg-base"
                      style={{ animationDelay: `${120 + i * 45}ms` }}
                    />
                  </span>
                  {i < words.length - 1 && " "}
                </Fragment>
              ))}
            </span>
          </h1>
          <div
            className="col-span-12 animate-reveal md:col-span-5"
            style={{ animationDelay: "520ms" }}
          >
            <Text>
              <Copy simple={HERO.body} technical={HERO.technical} />
            </Text>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="#scan">Scan a site</ButtonLink>
              <ButtonLink href="/atlas/demo" variant="secondary">
                Explore the pipeline
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>
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
