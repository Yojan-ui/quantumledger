"use client";

import dynamic from "next/dynamic";
import { Fragment, useEffect, useRef } from "react";
import { LiveStrip } from "@/components/live/LiveStrip";
import { RoomFeed } from "@/components/room/RoomFeed";
import { Button, ButtonLink, Container, Legend, Text } from "@/components/ui";
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
 * The hero is the pitch: one headline, one subline, two buttons, the globe and the live strip.
 * The headline is server-rendered and painted on the first frame; covers lift off it word by word.
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
    <section ref={ref} id="top" className="relative flex min-h-story flex-col" aria-label="Q-Setu">
      <LiveStrip />
      <Container className="grid flex-1 grid-cols-12 content-start gap-x-6 md:content-center">
        <div className="relative col-span-12 md:order-2 md:col-span-5 md:col-start-8">
          <div data-world-focus data-world-drag className="h-globe md:h-stage" aria-hidden />
          <Legend align="right" className="absolute bottom-0 left-0 md:-bottom-4" />
        </div>
        <div data-hero className="col-span-12 pb-16 pt-6 md:order-1 md:col-span-7 md:py-24">
          <h1 className="text-display-sm font-medium text-fg md:text-display">
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
          <div className="mt-6 max-w-text animate-reveal" style={{ animationDelay: "520ms" }}>
            <Text>
              <Copy simple={HERO.body} technical={HERO.technical} />
            </Text>
          </div>
          <div
            className="mt-8 flex flex-wrap gap-3 animate-reveal"
            style={{ animationDelay: "600ms" }}
          >
            <Button variant="primary" onClick={startTour} data-tour-start>
              Take the 3-minute tour
            </Button>
            <ButtonLink href="/#scan" variant="secondary">
              Scan any site
            </ButtonLink>
          </div>
          <div className="mt-10 animate-reveal" style={{ animationDelay: "680ms" }}>
            <RoomQR className="hidden md:flex" />
            <ButtonLink href="/join" variant="secondary" className="md:hidden">
              Join live on this phone
            </ButtonLink>
            <RoomFeed className="mt-5" />
          </div>
        </div>
      </Container>
    </section>
  );
}
