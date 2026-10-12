"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Code, Grid, Heading, Label, Section, SectionLabel, Text, TextLink } from "@/components/ui";
import dynamic from "next/dynamic";
import { LazyView } from "@/components/scenes/LazyView";
import { Copy, CopyHeading } from "@/components/ui/Copy";
import { world } from "@/components/world/store";
import { SOLUTIONS } from "@/data/solutions";
import { ADAPTERS } from "./chapters";

const SocketModel = dynamic(() => import("@/components/scenes/SocketModel"), { ssr: false });

/** Simple-mode lines for each adapter (no acronyms). */
const PLAIN: Record<string, string> = {
  shield: "Old servers. Nothing in them changes.",
  web: "Any website. One line of setup.",
  sdk: "New apps, built quantum-safe from the start.",
  edge: "Small devices like meters and card machines.",
  vault: "Stored records, each with its own lock.",
};

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
        world.glow = "kem";
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
        <SectionLabel index="05" label="Deploy anywhere" role="kem" />
        <Grid className="gap-y-12">
          <div className="col-span-12 lg:col-span-7">
            <CopyHeading
              simple="Five ways to add it. Each takes one line."
              technical="Five adapters. Each one line."
            />
            <ul className="mt-12 border-b border-line">
              {ADAPTERS.map((a, i) => (
                <li
                  key={a.id}
                  onPointerEnter={() => setHot(i)}
                  onPointerLeave={() => setHot(-1)}
                  className="flex items-center gap-6 border-t border-line py-6"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                      <Heading as="h3" variant="h3">
                        QuantumLedger{" "}
                        <Copy simple={a.id === "sdk" ? "for apps" : a.name} technical={a.name} />
                      </Heading>
                      <Text size="small">
                        <Copy simple={PLAIN[a.id]} technical={ONE_LINE[a.id]} />
                      </Text>
                    </div>
                    <div className="mt-4" data-copy="technical">
                      <Code code={a.code} />
                    </div>
                  </div>
                  {/* Hover: this adapter's socket model turns and lights KEM, as does its socket on the globe. */}
                  <LazyView
                    className="hidden h-socket w-socket shrink-0 md:block"
                    label={`QuantumLedger ${a.name} socket`}
                  >
                    {(on) => <SocketModel id={a.id} hot={hot === i} active={on} />}
                  </LazyView>
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
    <Section id="solutions" index="06" label="Solutions by sector" role="sig">
      <CopyHeading
        simple="Built for the services India relies on most."
        technical="Built for India’s most sensitive rails."
        className="max-w-text"
      />
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
              <Text className="col-span-12 md:col-span-7">
                <Copy
                  simple={s.problem}
                  technical={`${s.problem} Hybrid ML-KEM for ${s.kem.length} links; ML-DSA for ${s.dsa[0]!.toLowerCase()}.`}
                />
              </Text>
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
  "QuantumLedger",
  "PQC libraries (liboqs, OpenSSL 3.5+)",
  "PQ-TLS at the edge",
  "Doing nothing",
];
/** Simple-mode column and row names (no acronyms); notes are technical detail, shown in Technical. */
const COLS_SIMPLE = [
  "QuantumLedger",
  "Do-it-yourself crypto toolkits",
  "Quantum-safe front door only",
  "Doing nothing",
];
const ROWS_SIMPLE: Record<string, string> = {
  "Finds where you’re vulnerable (scanner + CBOM)": "Finds where you’re exposed",
  "Low-power device profile": "Works on small, low-power devices",
  "Tamper-evident, quantum-safe audit trail":
    "A record of every action that can’t be quietly edited",
  "Built around Indian sector workflows (UPI, ABDM, APAAR / DigiLocker)":
    "Built around how India pays, treats patients and issues degrees",
};

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
    note: "QuantumLedger’s are prototype flows modelled on these systems.",
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

/** The comparison table on its own (also used by /pitch). Rows stagger in when it scrolls into view. */
export function ComparisonTable() {
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
    <div className="overflow-x-auto">
      <table ref={table} className="w-full min-w-panel table-fixed text-left">
        <caption className="sr-only">
          <Copy
            simple="QuantumLedger compared with do-it-yourself toolkits, a quantum-safe front door only, and doing nothing"
            technical="QuantumLedger compared with PQC libraries, edge PQ-TLS and doing nothing"
          />
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
                <Copy simple={COLS_SIMPLE[i]} technical={c} />
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
                <span className="block text-body text-fg">
                  <Copy simple={ROWS_SIMPLE[r.k] ?? r.k} technical={r.k} />
                </span>
                {r.note && (
                  <span data-copy="technical" className="mt-1 block text-small text-fg-3">
                    {r.note}
                  </span>
                )}
              </th>
              {r.cells.map((c, i) => (
                <td key={i} className={`py-5 pr-4 text-small ${i === 0 ? "text-fg" : "text-fg-2"}`}>
                  {MARK[c]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 09: an honest comparison. Libraries are the foundation; QuantumLedger is built on them. */
export function WhyQSetu() {
  return (
    <Section id="why-quantumledger" index="09" label="Why QuantumLedger" role="kem">
      <CopyHeading
        simple="The new locks exist. Fitting them is the hard part."
        technical="Algorithms are solved. Deployment isn’t."
        className="max-w-text"
      />
      <div className="mt-12">
        <ComparisonTable />
      </div>
      <p className="mt-8 max-w-text text-body text-fg-2">
        <Copy
          simple="Toolkits give you the new locks. QuantumLedger gives India a way to fit them, on systems already running. It is built on widely used open-source code, not new inventions."
          technical="Libraries give you algorithms. QuantumLedger gives India a way to actually deploy them. It is built on widely used open-source implementations (the @noble libraries), not new cryptography."
        />
      </p>
    </Section>
  );
}
