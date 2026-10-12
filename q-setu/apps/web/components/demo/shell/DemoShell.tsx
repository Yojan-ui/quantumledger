"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Button, Container, Heading, Legend, Text } from "@/components/ui";
import { resetAll } from "@/lib/client/present";

/** One click (or R in presenter mode) puts every demo back to a clean start. */
function ResetAll() {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  return (
    <button
      type="button"
      aria-busy={state === "busy"}
      onClick={async () => {
        if (state === "busy") return;
        setState("busy");
        await resetAll();
        setState("done");
        setTimeout(() => setState("idle"), 1500);
      }}
      title="Reset every demo (R in presenter mode)"
      className="h-10 px-2 text-small text-fg-3 transition-colors duration-150 hover:text-fg"
    >
      {state === "busy" ? "Resetting…" : state === "done" ? "All reset ✓" : "Reset all"}
    </button>
  );
}

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
  /**
   * The demo's one "Try it": the same primary button in the same place on every demo, running that
   * demo's real sequence. `hint` says what it will do (the button's tooltip and description).
   */
  tryIt?: { run: () => unknown; hint: string; disabled?: boolean };
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
  tryIt,
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
            href="/demos"
            className="text-small text-fg-3 transition-colors duration-150 hover:text-fg"
          >
            ← Demos
          </Link>
          <Heading as="h1" variant="h3">
            {title}
          </Heading>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {tryIt && (
              <Button
                variant="primary"
                onClick={tryIt.run}
                disabled={tryIt.disabled}
                title={tryIt.hint}
                aria-description={tryIt.hint}
                data-try-it
              >
                Try it
              </Button>
            )}
            {controls}
            <ResetAll />
          </div>
          <div className="flex basis-full flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <Text size="small" className="max-w-text">
              {caption}
            </Text>
            <Legend align="right" />
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
