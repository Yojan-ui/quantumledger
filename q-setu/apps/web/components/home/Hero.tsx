"use client";

import { Fragment, useEffect, useRef } from "react";
import { LiveStrip } from "@/components/live/LiveStrip";
import { ButtonLink, Container, Text } from "@/components/ui";
import { world } from "@/components/world/store";
import { HERO } from "./chapters";

/**
 * The hero is the pitch: one headline, one subline, two buttons, the globe and the live strip.
 * The headline is server-rendered and rises word by word in pure CSS, so it paints immediately.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        world.chapter = 0;
        world.accent = "accent";
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
        <div
          data-world-focus
          data-world-drag
          className="col-span-12 h-globe md:order-2 md:col-span-5 md:col-start-8 md:h-stage"
          aria-hidden
        />
        <div data-hero className="col-span-12 pb-16 pt-6 md:order-1 md:col-span-7 md:py-24">
          <h1 className="text-display-sm font-medium text-fg md:text-display">
            <span className="sr-only">{HERO.title.replace(/‑/g, "-")}</span>
            <span aria-hidden>
              {words.map((w, i) => (
                <Fragment key={i}>
                  <span className="-mb-2 inline-block overflow-hidden pb-2 align-top">
                    <span
                      className="inline-block animate-mask-up"
                      style={{ animationDelay: `${120 + i * 45}ms` }}
                    >
                      {w}
                    </span>
                  </span>
                  {i < words.length - 1 && " "}
                </Fragment>
              ))}
            </span>
          </h1>
          <div className="mt-6 max-w-text animate-reveal" style={{ animationDelay: "520ms" }}>
            <Text>{HERO.body}</Text>
          </div>
          <div
            className="mt-8 flex flex-wrap gap-3 animate-reveal"
            style={{ animationDelay: "600ms" }}
          >
            <ButtonLink href="/demos">Try it live</ButtonLink>
            <ButtonLink href="/#scan" variant="secondary">
              Scan your site
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
