"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Code, Grid, Heading, Label, Text } from "@/components/ui";
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
} from "@/components/home/Proofs";

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
    name: "QuantumLedger Shield",
    socket: 0,
    problem: "Banks can’t rewrite 20-year-old core systems to add new cryptography.",
    fix: "Shield sits in front of them. Zero code changes.",
    proof: <ShieldProof />,
    code: "npx qsetu-shield --upstream http://localhost:4000 --listen 8443",
    without: "Every request between branch and core can be recorded now and read at Q-Day.",
  },
  {
    id: "web",
    name: "QuantumLedger Web",
    socket: 1,
    problem: "Banking portals send forms over TLS that can be recorded today.",
    fix: "One script tag seals every form before it leaves the browser.",
    proof: <WebProof />,
    code: '<script src="/qsetu.js" data-key="af29da952c68ee32" data-endpoint="/api/"></script>',
    without: "PAN, income and addresses sit in recorded traffic, waiting for a quantum computer.",
  },
  {
    id: "sdk",
    name: "QuantumLedger SDK",
    socket: 2,
    problem: "App teams can’t become cryptographers to protect their APIs.",
    fix: "One package: post-quantum sessions, envelopes and signatures.",
    proof: <SdkProof />,
    code: "npm i @qsetu/sdk",
    without: "Each team hand-rolls crypto, and every app ships its own RSA dependency.",
  },
  {
    id: "edge",
    name: "QuantumLedger Edge",
    socket: 3,
    problem: "Meters and POS terminals have kilobytes of RAM and a battery.",
    fix: "A post-quantum profile sized for devices: ML-KEM-512 and ML-DSA-44.",
    proof: <EdgeProof />,
    code: 'new EdgeDevice("meter-17", key, gateway, { ramBytes: 65_536 })',
    without: "Devices in the field for 15 years keep speaking crypto that expires in 10.",
  },
  {
    id: "vault",
    name: "QuantumLedger Vault",
    socket: 4,
    problem: "Backups and replicas leak, and a loan record outlives its encryption.",
    fix: "Every record gets its own key, wrapped with ML-KEM and signed with ML-DSA.",
    proof: <VaultProof />,
    code: "await vault.put(loanRecord)",
    without: "One stolen backup today is every account it holds, readable later.",
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
    name: "Proof Chain",
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

/** Problem → Fix → Proof for every adapter, the scanner and the ledger (on /platform). The globe follows the rows. */
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
    <section ref={ref} id="adapters" className="relative scroll-mt-14 py-24 md:py-40">
      <div className="mx-auto w-full max-w-container px-5 md:px-6">
        <Label className="mb-6 block">02 — Proof, per adapter</Label>
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
                    <span className="font-mono text-label uppercase">Without QuantumLedger · </span>
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
