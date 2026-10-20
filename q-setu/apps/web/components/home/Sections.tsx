"use client";

import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Code, Heading, Label, Section, SectionLabel, Text, TextLink } from "@/components/ui";
import dynamic from "next/dynamic";
import { chunkFailed } from "@/lib/client/chunk";
import { LazyView } from "@/components/scenes/LazyView";
import { Copy, CopyHeading } from "@/components/ui/Copy";
import { world } from "@/components/world/store";
import { SOLUTIONS } from "@/data/solutions";
import { ADAPTERS } from "./chapters";
import { useJourney } from "@/lib/client/journey";
import { termify } from "@/components/ui/Term";

const ShieldSlot = dynamic(
  () =>
    import("@/components/scenes/shield/ShieldSlot")
      .catch(() => import("@/components/scenes/shield/ShieldSlot"))

      .catch(chunkFailed),
  { ssr: false },
);

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

/**
 * 05 Deploy anywhere, as a pinned horizontal scroller: scrolling slides the five adapter cards
 * sideways while the 3D camera orbits a ring of five different objects (a proxy shield, a browser
 * window, a package, a chip, a vault door) to face the adapter whose card is in view.
 */
export function Adapters({ index = "05" }: { index?: string }) {
  const ref = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const focus = useMemo(() => ({ v: 0 }), []);
  const [hot, setHot] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (st) => {
          const n = ADAPTERS.length - 1;
          focus.v = st.progress * n;
          const t = track.current;
          if (t) {
            const room = t.scrollWidth - (t.parentElement?.clientWidth ?? 0);
            t.style.transform = `translate3d(${-Math.max(0, room) * st.progress}px, 0, 0)`;
          }
          const i = Math.round(st.progress * n);
          setHot((h) => (h === i ? h : i));
        },
        onToggle: (st) => {
          if (!st.isActive) return;
          world.accent = "accent";
          world.glow = "kem";
        },
      });
    }, el);
    return () => ctx.revert();
  }, [focus]);
  return (
    <section
      ref={ref}
      id="adapters"
      className="relative scroll-mt-14"
      style={{ height: `${ADAPTERS.length * 40 + 40}vh` }}
    >
      <div className="sticky top-14 h-story overflow-hidden">
        <div className="absolute inset-0">
          <LazyView
            className="h-full w-full"
            label={`Shield plugs into a bank's website, from a recorded real run: scan, install, a quantum-safe handshake, fixes and a signed report. In view: ${ADAPTERS[hot]?.name}`}
          >
            {(on) => <ShieldSlot focus={focus} steps={ADAPTERS.length - 1} active={on} />}
          </LazyView>
        </div>
        <div className="hero-scrim pointer-events-none absolute inset-0" aria-hidden />
        <div className="pointer-events-none relative mx-auto flex h-full w-full max-w-container flex-col justify-center gap-12 px-5 py-12 md:px-6 md:py-16">
          <div className="max-w-text">
            <SectionLabel index={index} label="Deploy anywhere" role="kem" />
            <CopyHeading
              simple="Five ways to add it. Each takes one line."
              technical="Five adapters. Each one line."
            />
          </div>
          <div className="fade-edges pointer-events-auto overflow-hidden">
            <div ref={track} className="flex gap-4 md:gap-6">
              {ADAPTERS.map((a, i) => (
                <article
                  key={a.id}
                  data-sealed
                  aria-current={i === hot || undefined}
                  className={`flex w-console shrink-0 flex-col border bg-base p-6 transition-colors duration-300 ${i === hot ? "border-kem" : "border-line hover:border-line-strong"}`}
                >
                  <Label as="p" className={i === hot ? "text-kem" : ""}>
                    {String(i + 1).padStart(2, "0")} / {String(ADAPTERS.length).padStart(2, "0")}
                  </Label>
                  <Heading as="h3" variant="h3" className="mt-3">
                    QuantumLedger{" "}
                    <Copy simple={a.id === "sdk" ? "for apps" : a.name} technical={a.name} />
                  </Heading>
                  <Text size="small" className="mt-2">
                    <Copy simple={PLAIN[a.id]} technical={ONE_LINE[a.id]} />
                  </Text>
                  <div className="mt-4" data-copy="technical">
                    <Code code={a.code} />
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-6">
              <TextLink href="/platform">How the platform fits together →</TextLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The wide pull-back before the sectors: the camera rises off India while its nodes and links turn
 * sealed one after another (the director's chapter 5 wave, then chapter 7: everything sealed),
 * scrubbed by scroll. A centred statement sits over it. An illustration of adoption, not data.
 */
function SealWave() {
  const ref = useRef<HTMLDivElement>(null);
  useJourney(ref, 8, 9, (p) => {
    world.chapter = p < 0.8 ? 5 + Math.min(0.999, p / 0.8) : 7;
    world.accent = "accent";
    world.glow = "kem";
  });
  return (
    <div ref={ref} className="relative h-svh min-h-hero overflow-hidden">
      <div data-world-focus data-world-drag className="absolute inset-0" aria-hidden />
      <div className="pointer-events-none relative flex h-full items-center justify-center px-5 text-center">
        <p className="max-w-text text-h1-sm font-medium text-fg md:text-display">
          One adapter at a time, every link sealed.
        </p>
      </div>
    </div>
  );
}

/** 06: one row per sector, linking to its solution page. */
export function Solutions({ index = "06" }: { index?: string }) {
  return (
    <>
      <SealWave />
      <SolutionsList index={index} />
    </>
  );
}

function SolutionsList({ index }: { index: string }) {
  return (
    <Section id="solutions" index={index} label="Solutions by sector" role="sig">
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
    // overflow-y-hidden: rows sliding in would otherwise make this box scroll vertically for a
    // moment and take the page's wheel (a visible jump back).
    <div className="overflow-x-auto overflow-y-hidden">
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
                  <Copy simple={termify(ROWS_SIMPLE[r.k] ?? r.k)} technical={termify(r.k)} />
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
export function WhyQSetu({ index = "09" }: { index?: string }) {
  return (
    <Section id="why-quantumledger" index={index} label="Why QuantumLedger" role="kem">
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
