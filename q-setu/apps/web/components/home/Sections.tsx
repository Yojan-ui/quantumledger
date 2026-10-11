"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Code, Grid, Heading, Label, Section, Text, TextLink } from "@/components/ui";
import { MaskHeading } from "@/components/ui/MaskHeading";
import { world } from "@/components/world/store";
import { SOLUTIONS } from "@/data/solutions";
import { ADAPTERS } from "./chapters";

const ONE_LINE: Record<string, string> = {
  shield: "Legacy servers and APIs. Zero code change.",
  web: "Any website. One script tag seals every form.",
  sdk: "New apps. Sessions, envelopes and signatures.",
  edge: "Meters, monitors and POS. Sized for kilobytes.",
  vault: "Databases and files. A key per record.",
};

/** 05: the five adapters as a list. Hovering a row lights its socket on the globe. */
export function Adapters() {
  const ref = useRef<HTMLElement>(null);
  const [hot, setHot] = useState(-1);
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        world.chapter = 4.5; // the director's "sockets" pose
        world.accent = "accent";
      },
      { threshold: 0.3 },
    );
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => void (world.socket = hot), [hot]);
  return (
    <section ref={ref} id="adapters" className="relative scroll-mt-14 py-24 md:py-40">
      <div className="mx-auto w-full max-w-container px-5 md:px-6">
        <Label className="mb-6 block">05 — Adapters</Label>
        <Grid className="gap-y-12">
          <div className="col-span-12 lg:col-span-7">
            <MaskHeading text="Five ways in. Each one line." />
            <ul className="mt-12 border-b border-line">
              {ADAPTERS.map((a, i) => (
                <li
                  key={a.id}
                  onPointerEnter={() => setHot(i)}
                  onPointerLeave={() => setHot(-1)}
                  className="border-t border-line py-6"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <Heading as="h3" variant="h3">
                      Q-Setu {a.name}
                    </Heading>
                    <Text size="small">{ONE_LINE[a.id]}</Text>
                  </div>
                  <div className="mt-4">
                    <Code code={a.code} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <TextLink href="/platform">How the platform fits together →</TextLink>
            </div>
          </div>
          <div className="col-span-12 hidden lg:col-span-5 lg:block">
            <div data-world-focus className="sticky top-24 h-stage" aria-hidden />
          </div>
        </Grid>
      </div>
    </section>
  );
}

/** 06: one row per sector, linking to its solution page. */
export function Solutions() {
  return (
    <Section id="solutions" index="06" label="Solutions">
      <MaskHeading text="Built for India’s most sensitive rails." className="max-w-text" />
      <ul className="mt-12 border-b border-line">
        {SOLUTIONS.map((s) => (
          <li key={s.id} className="border-t border-line">
            <Link
              href={`/solutions/${s.id}`}
              className="group grid grid-cols-12 gap-x-6 gap-y-2 py-8"
            >
              <Heading as="h3" variant="h2" className="col-span-12 md:col-span-3">
                {s.name}
              </Heading>
              <Text className="col-span-12 md:col-span-7">{s.problem}</Text>
              <span className="col-span-12 self-center text-small text-fg-3 transition-colors duration-150 group-hover:text-fg md:col-span-2 md:text-right">
                {s.name} →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

type Cell = "yes" | "partial" | "no";
const COLS = [
  "Q-Setu",
  "PQC libraries (liboqs, OpenSSL 3.5+)",
  "PQ-TLS at the edge",
  "Doing nothing",
];
const ROWS: { k: string; cells: [Cell, Cell, Cell, Cell]; note?: string }[] = [
  {
    k: "Works with legacy systems with zero code change",
    cells: ["yes", "no", "partial", "no"],
    note: "Edge TLS covers browser → CDN only, not internal links.",
  },
  {
    k: "Protects data at rest (databases, files), not just in transit",
    cells: ["yes", "partial", "no", "no"],
    note: "Libraries provide the primitives; you build the storage scheme.",
  },
  {
    k: "Signs documents and transactions",
    cells: ["yes", "partial", "no", "no"],
    note: "Libraries ship ML-DSA, not certificate or payment workflows.",
  },
  {
    k: "Low-power device profile",
    cells: ["yes", "partial", "no", "no"],
    note: "Embedded PQC builds exist; tuning them is on you.",
  },
  { k: "Finds where you’re vulnerable (scanner + CBOM)", cells: ["yes", "no", "no", "no"] },
  { k: "Generates a migration plan", cells: ["yes", "no", "no", "no"] },
  {
    k: "Tamper-evident, quantum-safe audit trail",
    cells: ["yes", "partial", "no", "no"],
    note: "Hash and signature primitives only.",
  },
  {
    k: "Built around Indian sector workflows (UPI, ABDM, APAAR / DigiLocker)",
    cells: ["yes", "no", "no", "no"],
    note: "Q-Setu’s are prototype flows modelled on these systems.",
  },
];
const MARK: Record<Cell, ReactNode> = {
  yes: (
    <>
      <span className="mr-2 text-accent" aria-hidden>
        ●
      </span>
      Yes
    </>
  ),
  partial: (
    <>
      <span className="mr-2 text-fg-2" aria-hidden>
        ◐
      </span>
      Partial
    </>
  ),
  no: <span className="text-fg-3">No</span>,
};

/** An honest comparison: libraries are the foundation (Q-Setu is built on vetted ones). */
export function WhyQSetu() {
  const table = useRef<HTMLTableElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => e?.isIntersecting && (setSeen(true), io.disconnect()),
      {
        rootMargin: "0px 0px -15% 0px",
      },
    );
    if (table.current) io.observe(table.current);
    return () => io.disconnect();
  }, []);
  return (
    <Section id="why-q-setu" index="08" label="Why Q-Setu">
      <MaskHeading text="Algorithms are solved. Deployment isn’t." className="max-w-text" />
      <div className="mt-12 overflow-x-auto">
        <table ref={table} className="w-full min-w-panel table-fixed text-left">
          <caption className="sr-only">
            Q-Setu compared with PQC libraries, edge PQ-TLS and doing nothing
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th className="w-1/3 pb-4">
                <span className="sr-only">Capability</span>
              </th>
              {COLS.map((c, i) => (
                <Label
                  as="th"
                  key={c}
                  tone={i === 0 ? "strong" : "muted"}
                  className="w-1/6 pb-4 pr-4 align-bottom font-normal"
                >
                  {c}
                </Label>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr
                key={r.k}
                className={`border-b border-line align-top ${seen ? "animate-reveal" : "opacity-0"}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <th scope="row" className="py-5 pr-6 text-left font-normal">
                  <span className="block text-body text-fg">{r.k}</span>
                  {r.note && <span className="mt-1 block text-small text-fg-3">{r.note}</span>}
                </th>
                {r.cells.map((c, i) => (
                  <td
                    key={i}
                    className={`py-5 pr-4 text-small ${i === 0 ? "text-fg" : "text-fg-2"}`}
                  >
                    {MARK[c]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-8 max-w-text text-body text-fg-2">
        Libraries give you algorithms. Q-Setu gives India a way to actually deploy them. It is built
        on widely used open-source implementations (the @noble libraries), not new cryptography.
      </p>
    </Section>
  );
}
