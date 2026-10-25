"use client";

import { Grid, Heading, Panel, Reveal, Text } from "@/components/ui";
import { useEffect, useRef } from "react";
import { track } from "@/lib/client/analytics";
import { termify } from "@/components/ui/Term";

export const DEMOS = [
  {
    href: "/demo/how-it-works",
    video: "/previews/handshake.webm",
    title: "How it works",
    body: "A real hybrid handshake in your browser, an attack that fails, and a live algorithm swap.",
  },
  {
    href: "/demo/deploy",
    video: "/previews/deploy.webm",
    title: "Deploy anywhere",
    body: "Protect a website, API, app, device and database; watch their counters climb.",
  },
  {
    href: "/demo/qday",
    video: "/previews/qday.webm",
    title: "Q-Day Time Machine",
    body: "Fast-forward to Q-Day and watch which recordings open.",
  },
  {
    href: "/demo/ledger",
    video: "/previews/ledger.webm",
    title: "Proof Chain",
    body: "Edit an audit-log row in the database and watch verification pinpoint it.",
  },
];

export function DemoPanels() {
  return (
    <Grid className="gap-y-6">
      {DEMOS.map((d, i) => (
        <Reveal key={d.href} delay={i * 60} className="col-span-12 md:col-span-6">
          <Panel as="article" padded={false} className="group h-full overflow-hidden">
            <a
              href={d.href}
              className="block h-full"
              onClick={() => track("demo_opened", { demo: d.href })}
            >
              <PreviewVideo src={d.video} />
              <div className="p-6">
                <Heading as="h3" variant="h3">
                  {d.title}
                </Heading>
                <Text size="small" className="mt-2">
                  {termify(d.body)}
                </Text>
                <p className="mt-6 text-small text-fg">Launch →</p>
              </div>
            </a>
          </Panel>
        </Reveal>
      ))}
    </Grid>
  );
}

/**
 * A demo preview that plays only while it's on screen (paused otherwise, so four videos don't
 * decode at once) and not at all under reduced motion. The 16:9 box is reserved from the start.
 */
function PreviewVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) void v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <video
      ref={ref}
      className="aspect-video w-full border-b border-line bg-inset object-cover"
      src={src}
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden
    />
  );
}
