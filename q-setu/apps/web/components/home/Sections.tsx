"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ButtonLink,
  Code,
  Divider,
  Grid,
  Heading,
  Label,
  Panel,
  Reveal,
  Section,
  Text,
  TextLink,
} from "@/components/ui";
import { MaskHeading } from "@/components/ui/MaskHeading";
import { world } from "@/components/world/store";
import {
  EdgeProof,
  LedgerProof,
  ScanProof,
  SdkProof,
  ShieldProof,
  VaultProof,
  WebProof,
} from "./Proofs";

interface Feature {
  id: string;
  name: string;
  /** Index into the globe's adapter sockets, for the five adapters. */
  socket?: number;
  problem: string;
  fix: string;
  proof: ReactNode;
  code?: string;
  without: string;
}

const FEATURES: Feature[] = [
  {
    id: "shield",
    name: "Q-Setu Shield",
    socket: 0,
    problem: "Banks can’t rewrite 20-year-old core systems to add new cryptography.",
    fix: "Shield sits in front of them. Zero code changes.",
    proof: <ShieldProof />,
    code: "npx qsetu-shield --upstream http://localhost:4000 --listen 8443",
    without: "Every request between branch and core can be recorded now and read at Q-Day.",
  },
  {
    id: "web",
    name: "Q-Setu Web",
    socket: 1,
    problem: "Citizen portals send forms over TLS that can be recorded today.",
    fix: "One script tag seals every form before it leaves the browser.",
    proof: <WebProof />,
    code: '<script src="/qsetu.js" data-key="af29da952c68ee32" data-endpoint="/api/"></script>',
    without: "PAN, income and addresses sit in recorded traffic, waiting for a quantum computer.",
  },
  {
    id: "sdk",
    name: "Q-Setu SDK",
    socket: 2,
    problem: "App teams can’t become cryptographers to protect their APIs.",
    fix: "One package: post-quantum sessions, envelopes and signatures.",
    proof: <SdkProof />,
    code: "npm i @qsetu/sdk",
    without: "Each team hand-rolls crypto, and every app ships its own RSA dependency.",
  },
  {
    id: "edge",
    name: "Q-Setu Edge",
    socket: 3,
    problem: "Meters and POS terminals have kilobytes of RAM and a battery.",
    fix: "A post-quantum profile sized for devices: ML-KEM-512 and ML-DSA-44.",
    proof: <EdgeProof />,
    code: 'new EdgeDevice("meter-17", key, gateway, { ramBytes: 65_536 })',
    without: "Devices in the field for 15 years keep speaking crypto that expires in 10.",
  },
  {
    id: "vault",
    name: "Q-Setu Vault",
    socket: 4,
    problem: "Backups and replicas leak, and a health record outlives its encryption.",
    fix: "Every record gets its own key, wrapped with ML-KEM and signed with ML-DSA.",
    proof: <VaultProof />,
    code: "await vault.put(labReport)",
    without: "One stolen backup today is every diagnosis it holds, readable later.",
  },
  {
    id: "scanner",
    name: "Readiness Scanner",
    problem: "Nobody knows where RSA and elliptic curves hide in their stack.",
    fix: "Scan a live site or a config. Get a score, a CBOM and a migration plan.",
    proof: <ScanProof />,
    without: "Migration budgets get spent on guesses, and the riskiest systems go last.",
  },
  {
    id: "ledger",
    name: "Q-Ledger",
    problem: "An insider with database access can quietly rewrite an audit log.",
    fix: "Every entry is hash-chained with SHA3-256 and signed with ML-DSA-65.",
    proof: <LedgerProof />,
    without: "The audit trail proves nothing, and its signatures can be forged after Q-Day.",
  },
];

/** A 1px line from the hovered row to its socket on the globe (drawn over everything, no pointer events). */
function SocketLine({ row }: { row: HTMLElement | null }) {
  const line = useRef<SVGLineElement>(null);
  useEffect(() => {
    if (!row) return;
    let raf = 0;
    const tick = () => {
      const l = line.current;
      const s = world.socketScreen;
      if (l) {
        const r = row.getBoundingClientRect();
        const visible = !!s && r.bottom > 56 && r.top < window.innerHeight;
        l.style.opacity = visible ? "1" : "0";
        if (s) {
          l.setAttribute("x1", String(r.right + 12));
          l.setAttribute("y1", String(r.top + 28));
          l.setAttribute("x2", String(s.x));
          l.setAttribute("y2", String(s.y));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [row]);
  if (!row) return null;
  return (
    <svg
      className="pointer-events-none fixed inset-0 z-20 hidden h-full w-full lg:block"
      aria-hidden
    >
      <line
        ref={line}
        stroke="var(--line-strong)"
        strokeWidth={1}
        className="transition-opacity duration-150"
      />
    </svg>
  );
}

/** Problem → Fix → Proof for every adapter, the scanner and the ledger. The globe follows the rows. */
export function Features() {
  const ref = useRef<HTMLElement>(null);
  const [hot, setHot] = useState(-1);
  const [row, setRow] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        world.chapter = 4.5; // the director's "sockets" pose
        world.accent = "accent";
      },
      { threshold: 0.1 },
    );
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => void (world.socket = hot), [hot]);

  return (
    <section ref={ref} id="product" className="relative scroll-mt-14 py-24 md:py-40">
      <div className="mx-auto w-full max-w-container px-5 md:px-6">
        <Label className="mb-6 block">09 — Product</Label>
        <Grid className="gap-y-12">
          <div className="col-span-12 lg:col-span-7">
            <MaskHeading text="Seven problems. Each fixed in one line." />
            <Text className="mt-4 max-w-text">
              Five adapters on one core, plus the tools to find what’s exposed and prove what
              happened.
            </Text>
            <ol className="mt-16 border-b border-line">
              {FEATURES.map((f) => (
                <li
                  key={f.id}
                  id={f.id}
                  onPointerEnter={(e) => {
                    if (f.socket === undefined) return;
                    setHot(f.socket);
                    setRow(e.currentTarget);
                  }}
                  onPointerLeave={() => {
                    setHot(-1);
                    setRow(null);
                  }}
                  className="scroll-mt-24 border-t border-line py-12"
                >
                  <div className="flex items-baseline justify-between gap-6">
                    <Label as="p" tone="strong">
                      The problem
                    </Label>
                    <Label as="p">{f.name}</Label>
                  </div>
                  <Text className="mt-3 max-w-text">{f.problem}</Text>
                  <Heading as="h3" variant="h2" className="mt-6 max-w-text">
                    {f.fix}
                  </Heading>
                  {f.code && (
                    <div className="mt-6">
                      <Code code={f.code} />
                    </div>
                  )}
                  <Label as="p" className="mb-3 mt-8 block">
                    Proof
                  </Label>
                  {f.proof}
                  <p className="mt-8 text-small text-warn">
                    <span className="font-mono text-label uppercase">Without Q-Setu · </span>
                    {f.without}
                  </p>
                </li>
              ))}
            </ol>
          </div>
          <div className="col-span-12 hidden lg:col-span-5 lg:block">
            <div data-world-focus className="sticky top-24 h-stage" aria-hidden />
          </div>
        </Grid>
      </div>
      <SocketLine row={row} />
    </section>
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
    <Section id="why-q-setu" index="10" label="Why Q-Setu">
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
        on vetted open-source implementations (noble post-quantum), not new cryptography.
      </p>
    </Section>
  );
}

const SECTORS = [
  {
    name: "Fintech",
    lines: [
      ["Problem", "Bank, switch and app traffic is recorded today and stays valuable for years."],
      ["ML-KEM protects", "Bank-to-switch links (Shield) and app-to-bank APIs (SDK)."],
      ["ML-DSA protects", "Transaction signing and recurring mandates."],
      ["Without Q-Setu", "Recorded payments readable at Q-Day; mandates forgeable."],
    ],
  },
  {
    name: "Healthcare",
    lines: [
      [
        "Problem",
        "A diagnosis stays sensitive for a lifetime, so health exchanges are prime targets.",
      ],
      ["ML-KEM protects", "Hospital-to-exchange transfers (Shield) and records at rest (Vault)."],
      ["ML-DSA protects", "Lab reports and prescriptions; Edge covers bedside monitors."],
      ["Without Q-Setu", "Diagnoses, IDs and family histories exposed years later."],
    ],
  },
  {
    name: "Education",
    lines: [
      ["Problem", "A degree is checked for forty years; its signature must outlive Q-Day."],
      ["ML-KEM protects", "Student-data transfers between universities and registries."],
      ["ML-DSA protects", "University-signed certificates, verified from a QR code."],
      ["Without Q-Setu", "Forged degrees with valid-looking signatures."],
    ],
  },
];

export function Industries() {
  return (
    <Section id="industries" index="11" label="Industries">
      <div className="max-w-text">
        <MaskHeading text="Built for India’s busiest rails." />
        <Text className="mt-4">
          These systems carry data that must stay private, or provable, for decades.
        </Text>
      </div>
      <div className="mt-16">
        {SECTORS.map((s, i) => (
          <Reveal key={s.name} delay={i * 60}>
            <Grid className="gap-y-6 border-t border-line py-12">
              <Heading as="h3" variant="h2" className="col-span-12 md:col-span-3">
                {s.name}
              </Heading>
              <dl className="col-span-12 space-y-3 md:col-span-8 md:col-start-5">
                {s.lines.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-1 gap-1 md:grid-cols-12 md:gap-6">
                    <Label as="dt" className="md:col-span-3 md:pt-1">
                      {k}
                    </Label>
                    <dd
                      className={`text-body md:col-span-9 ${k === "Without Q-Setu" ? "text-warn" : "text-fg-2"}`}
                    >
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </Grid>
          </Reveal>
        ))}
        <Divider />
      </div>
    </Section>
  );
}

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
    title: "Q-Ledger",
    body: "Edit an audit-log row in the database and watch verification pinpoint it.",
  },
];

export function DemoPanels() {
  return (
    <Grid className="gap-y-6">
      {DEMOS.map((d, i) => (
        <Reveal key={d.href} delay={i * 60} className="col-span-12 md:col-span-6">
          <Panel as="article" padded={false} className="group h-full overflow-hidden">
            <a href={d.href} className="block h-full">
              <video
                className="aspect-video w-full border-b border-line bg-inset object-cover"
                src={d.video}
                muted
                loop
                autoPlay
                playsInline
                preload="metadata"
                aria-hidden
              />
              <div className="p-6">
                <Heading as="h3" variant="h3">
                  {d.title}
                </Heading>
                <Text size="small" className="mt-2">
                  {d.body}
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

export function Demos() {
  return (
    <Section id="demos" index="12" label="Demos">
      <MaskHeading text="Real crypto. No slides." className="max-w-text" />
      <Text className="mt-4 max-w-text">
        Every packet, key and number in these demos is produced live, in your browser or on this
        server, and streamed to a console beside it.
      </Text>
      <div className="mt-12">
        <DemoPanels />
      </div>
      <div className="mt-8">
        <TextLink href="/demo/scanner">
          Or scan your own stack with the Readiness Scanner →
        </TextLink>
      </div>
    </Section>
  );
}

export function FinalCta() {
  return (
    <section className="border-t border-line py-24 md:py-40">
      <div className="mx-auto max-w-container px-5 md:px-6">
        <MaskHeading text="Be quantum-safe before Q‑Day." className="max-w-text" />
        <div className="mt-8">
          <ButtonLink href="/demo">Run the demos →</ButtonLink>
        </div>
      </div>
    </section>
  );
}
