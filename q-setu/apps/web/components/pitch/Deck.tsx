"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ComparisonTable } from "@/components/home/Sections";
import { MOMENTS } from "@/components/home/WhyNow";
import { LiveStrip } from "@/components/live/LiveStrip";
import { SinceArrival } from "@/components/live/SinceArrival";
import { Architecture } from "@/components/platform/Architecture";
import { Container, Label, Text } from "@/components/ui";
import { Mark } from "@/components/ui/Logo";
import { Odometer } from "@/components/ui/Odometer";
import { fact, footnote } from "@/data/facts";
import { useMetrics } from "@/lib/client/live";

function LiveRate() {
  const m = useMetrics();
  return (
    <p className="tabular text-h1-sm font-medium text-fg md:text-h1">
      <Odometer value={m ? m.opsPerSec.toFixed(1) : "0.0"} />{" "}
      <span className="text-h2 text-fg-3">ops/sec, live</span>
    </p>
  );
}

const SLIDES: { label: string; title: string; body: ReactNode }[] = [
  {
    label: "Problem",
    title: "Your data is being harvested today.",
    body: (
      <>
        <Text className="max-w-text">
          Encrypted traffic recorded now can be decrypted once a large quantum computer exists.
          Health records, identity and financial histories must stay secret for decades.
        </Text>
        <div className="max-w-text">
          <SinceArrival />
        </div>
      </>
    ),
  },
  {
    label: "Why now",
    title: "The clock started before the quantum computer exists.",
    body: (
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {MOMENTS.filter((m) => fact(m.factId))
          .slice(0, 3)
          .map((m) => (
            <div key={m.factId} className="border-t border-line pt-6">
              <p className="tabular text-h1-sm font-medium text-fg">{m.when}</p>
              <Text size="small" className="mt-3">
                {m.text} <span className="font-mono text-fg-3">[{footnote(m.factId)}]</span>
              </Text>
            </div>
          ))}
      </div>
    ),
  },
  {
    label: "Solution",
    title: "One core. Five ways in. One line each.",
    body: <Architecture />,
  },
  {
    label: "Live demo",
    title: "Real crypto, running right now.",
    body: (
      <>
        <LiveRate />
        <ol className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
          {[
            ["1", "How it works: a real hybrid handshake", "/demo/how-it-works"],
            ["2", "Deploy anywhere: five adapters", "/demo/deploy"],
            ["3", "Q-Day: recordings open", "/demo/qday"],
            ["4", "Q-Ledger: catch an insider", "/demo/ledger"],
            ["5", "Scan any website", "/demo/scanner"],
          ].map(([k, t, href]) => (
            <li key={k}>
              <Link
                href={href!}
                className="flex gap-3 border-t border-line py-3 text-body text-fg-2 hover:text-fg"
              >
                <span className="font-mono text-fg-3">{k}</span>
                {t}
              </Link>
            </li>
          ))}
        </ol>
      </>
    ),
  },
  {
    label: "How it’s different",
    title: "Algorithms are solved. Deployment isn’t.",
    body: <ComparisonTable />,
  },
  {
    label: "Business model",
    title: "Free to self-host. Paid when we run it for you.",
    body: (
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {[
          ["Community", "Free", "Self-hosted core, five adapters, scanner"],
          ["Pro", "Pricing not set", "Managed Shield, hosted Q-Ledger, support"],
          ["Government & Enterprise", "Contract", "On-prem, HSM keys, compliance support"],
        ].map(([n, p, d]) => (
          <div key={n} className="border-t border-line pt-6">
            <p className="text-h3 font-medium text-fg">{n}</p>
            <p className="mt-2 text-h2 font-medium text-fg">{p}</p>
            <Text size="small" className="mt-2">
              {d}
            </Text>
          </div>
        ))}
      </div>
    ),
  },
  {
    label: "Ask",
    title: "Three design partners before Q-Day becomes urgent.",
    body: (
      <>
        <Text className="max-w-text">
          A bank, a hospital and a university to run Q-Setu in shadow mode. No customers yet, so no
          logos: just working code you can verify today.
        </Text>
        <p className="font-mono text-label uppercase text-fg-3">
          Quantum-safe India before Q-Day · /contact
        </p>
      </>
    ),
  },
];

/** Slides whose content needs the full width (diagram, table, three columns). */
const WIDE = new Set([1, 2, 4, 5]);

/** /pitch: seven slides from the site's own components. ←/→ (or the buttons) move; the URL hash keeps the slide. */
export function Deck() {
  const [i, setI] = useState(0);
  const n = SLIDES.length;
  const go = useCallback(
    (k: number) => {
      const next = Math.max(0, Math.min(n - 1, k));
      setI(next);
      history.replaceState(null, "", `#${next + 1}`);
    },
    [n],
  );
  useEffect(() => {
    const h = Number(location.hash.slice(1));
    if (h >= 1 && h <= n) setI(h - 1);
  }, [n]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(i + 1);
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(i - 1);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [i, go]);

  const s = SLIDES[i]!;
  return (
    <main id="main" className="flex min-h-svh flex-col">
      {i === 3 && <LiveStrip />}
      <Container className="grid flex-1 grid-cols-12 items-center gap-x-6 py-16">
        {/* Text-led slides share the screen with the live globe; wide content takes the full width. */}
        <div
          key={i}
          className={`col-span-12 animate-reveal space-y-10 ${WIDE.has(i) ? "" : "lg:col-span-7"}`}
        >
          <div>
            <Label>
              {String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")} — {s.label}
            </Label>
            <h1 className="mt-4 max-w-text text-h1-sm font-medium text-fg md:text-display">
              {s.title}
            </h1>
          </div>
          {s.body}
        </div>
        {!WIDE.has(i) && (
          <div
            data-world-focus
            data-world-drag
            aria-hidden
            className="col-span-5 hidden h-stage lg:block"
          />
        )}
      </Container>
      <Container className="flex items-center justify-between border-t border-line py-4">
        <span className="flex items-center gap-2 text-small text-fg">
          <Mark /> Q-Setu
        </span>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => go(i - 1)}
            disabled={i === 0}
            className="text-small text-fg-2 hover:text-fg disabled:opacity-40"
          >
            ← Back
          </button>
          <span className="tabular font-mono text-label text-fg-3" aria-live="polite">
            {i + 1} / {n}
          </span>
          <button
            type="button"
            onClick={() => go(i + 1)}
            disabled={i === n - 1}
            className="text-small text-fg-2 hover:text-fg disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </Container>
    </main>
  );
}
