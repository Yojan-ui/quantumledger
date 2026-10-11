"use client";

import { useEffect, useRef } from "react";
import { LiveStrip } from "@/components/live/LiveStrip";
import { ButtonLink, Container, Label, Text, TextLink } from "@/components/ui";
import { MaskHeading } from "@/components/ui/MaskHeading";
import { world } from "@/components/world/store";
import { HeroStats } from "./ChapterBody";
import { CHAPTERS } from "./chapters";

/** Hero: the live strip, the headline, and the globe in its own columns, busy with real traffic. */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const ch = CHAPTERS[0]!;
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        world.chapter = 0;
        world.accent = ch.accent;
      },
      { threshold: 0.3 },
    );
    if (ref.current) io.observe(ref.current);
    world.chapter = 0;
    world.accent = ch.accent;
    return () => io.disconnect();
  }, [ch.accent]);

  return (
    <section ref={ref} id="top" className="relative flex min-h-story flex-col" aria-label="Q-Setu">
      <LiveStrip />
      <Container className="grid flex-1 grid-cols-12 content-start gap-x-6 md:content-stretch">
        <div
          data-world-focus
          data-world-drag
          className="col-span-12 h-globe md:order-2 md:col-span-5 md:col-start-8 md:h-auto"
          aria-hidden
        />
        <div
          data-hero
          className="col-span-12 pb-16 pt-6 md:order-1 md:col-span-7 md:pb-40 md:pt-24"
        >
          <div className="animate-reveal">
            <Label>01 — {ch.label}</Label>
          </div>
          <MaskHeading as="h1" variant="display" text={ch.title} className="mt-4" delay={60} />
          <div className="mt-4 max-w-text animate-reveal" style={{ animationDelay: "300ms" }}>
            <Text>{ch.body}</Text>
          </div>
          <div
            className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 animate-reveal"
            style={{ animationDelay: "360ms" }}
          >
            <div className="flex gap-3">
              <ButtonLink href="/demo">Run the demos →</ButtonLink>
              <ButtonLink href="/docs" variant="secondary">
                Read the docs
              </ButtonLink>
            </div>
            <TextLink href="/demo/scanner#url" className="text-fg-2">
              Scan your site for quantum risk →
            </TextLink>
          </div>
        </div>
      </Container>
      <HeroStats />
    </section>
  );
}
