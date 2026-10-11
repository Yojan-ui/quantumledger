"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Container, Heading, Text } from "@/components/ui";

interface Props {
  title: string;
  /** "What you're seeing": two lines at most. */
  caption: ReactNode;
  controls?: ReactNode;
  meter?: ReactNode;
  /** The live console beside the stage (right column on wide screens, below it otherwise). */
  console?: ReactNode;
  children: ReactNode;
  /** Called once in embed mode, so preview recordings start by themselves. */
  onAutoplay?: () => void;
}

/** Full-screen demo frame: header with caption and controls, the stage, a live console and a docked Compute Meter. */
export function DemoShell({
  title,
  caption,
  controls,
  meter,
  console: side,
  children,
  onAutoplay,
}: Props) {
  // ?embed=1 hides the chrome; used to record the looping previews on the home page.
  const [embed, setEmbed] = useState(false);
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("embed")) return;
    setEmbed(true);
    const t = setTimeout(() => onAutoplay?.(), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (embed)
    return (
      <main id="main">
        <Container className="py-12">{children}</Container>
      </main>
    );
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-base">
        <Container className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
          <Link
            href="/demo"
            className="text-small text-fg-3 transition-colors duration-150 hover:text-fg"
          >
            ← Demos
          </Link>
          <Heading as="h1" variant="h3">
            {title}
          </Heading>
          {controls && <div className="ml-auto flex flex-wrap items-center gap-2">{controls}</div>}
          <div className="basis-full">
            <Text size="small" className="max-w-text">
              {caption}
            </Text>
          </div>
        </Container>
      </header>
      <main id="main" className="flex-1">
        <Container className="py-12">
          {side ? (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-split">
              <div className="min-w-0">{children}</div>
              <aside className="xl:sticky xl:top-24 xl:self-start">{side}</aside>
            </div>
          ) : (
            children
          )}
        </Container>
      </main>
      {meter && (
        <div className="z-30 border-t border-line bg-base md:sticky md:bottom-0">{meter}</div>
      )}
    </div>
  );
}
