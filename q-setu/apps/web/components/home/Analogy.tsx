"use client";

/**
 * Right after the hero: Q-Setu as an everyday story in four steps, each with a small 3D object.
 * Locks → a future master key → thieves copying boxes now → new locks on the same doors. Cards are
 * transparent: the 3D layer sits under the page, so an opaque card would hide its object.
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Container, SectionLabel } from "@/components/ui";
import { Copy, CopyHeading } from "@/components/ui/Copy";
import { Term } from "@/components/ui/Term";
import { LazyView } from "@/components/scenes/LazyView";
import { footnote } from "@/data/facts";

const AnalogyModel = dynamic(() => import("@/components/scenes/AnalogyModel"), { ssr: false });

const STEPS = [
  {
    title: { simple: "Everything has a lock", technical: "Today: classical key exchange" },
    simple:
      "What you send to your bank, hospital or a government site is locked on the way. Only they can open it.",
    technical: (
      <>
        <Term id="tls">TLS</Term> agrees a key with <Term id="x25519">X25519</Term> or P-256, proves
        identity with <Term id="rsa">RSA-2048</Term> or ECDSA, then encrypts with{" "}
        <Term id="aes">AES-256-GCM</Term>.
      </>
    ),
    label: "A padlock made of dots",
  },
  {
    title: { simple: "A master key is coming", technical: "Shor's algorithm breaks RSA and ECC" },
    simple:
      "A large quantum computer would be a master key for today's locks. The US standards body has already proposed retiring those locks from 2030.",
    technical: (
      <>
        A cryptographically relevant quantum computer breaks RSA and elliptic curves. NIST&apos;s
        draft plan deprecates them after 2030 and disallows them after 2035, to get ahead of{" "}
        <Term id="q-day">Q-Day</Term>.
      </>
    ),
    label: "A glowing key",
    cite: "ir8547",
  },
  {
    title: { simple: "Thieves copy the boxes now", technical: "Harvest now, decrypt later" },
    simple:
      "They can't open the boxes yet, so they copy them today and keep them until the master key exists.",
    technical: (
      <>
        <Term id="hndl">Harvest now, decrypt later</Term>: encrypted traffic recorded today opens
        after Q-Day. Health, tax and identity records must stay secret far longer than that.
      </>
    ),
    label: "Copies of boxes flying into a vault",
  },
  {
    title: { simple: "New locks, same doors", technical: "Hybrid ML-KEM, no rewrite" },
    simple:
      "Q-Setu adds a new kind of lock that the master key can't open, without rebuilding your systems.",
    technical: (
      <>
        Q-Setu adds <Term id="hybrid">hybrid</Term> X25519 + <Term id="ml-kem">ML-KEM-768</Term>{" "}
        (FIPS 203) and <Term id="ml-dsa">ML-DSA</Term> (FIPS 204) through five adapters, in front of
        systems that stay as they are.
      </>
    ),
    label: "The padlock becomes a lattice lock",
  },
] as const;

export function Analogy({ index }: { index: string }) {
  const [reduce, setReduce] = useState(false);
  useEffect(() => setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  return (
    <section id="analogy" className="relative scroll-mt-14 py-24 md:py-32" data-tour="analogy">
      <Container>
        <SectionLabel index={index} label="In four steps" role="kem" />
        <CopyHeading
          simple="Why your data needs new locks."
          technical="The quantum threat, and the fix, in four steps."
          className="max-w-text"
        />
        <ol className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li
              key={i}
              data-tilt
              className="spotlight flex flex-col rounded-lg border border-line p-6 transition-colors duration-150 hover:border-line-strong"
            >
              <LazyView className="h-40 w-full" label={s.label}>
                {(on) => <AnalogyModel step={i as 0 | 1 | 2 | 3} active={on} reduce={reduce} />}
              </LazyView>
              <p className="mt-4 font-mono text-label uppercase text-fg-3">0{i + 1}</p>
              <h3 className="mt-2 text-h3 font-medium text-fg">
                <Copy simple={s.title.simple} technical={s.title.technical} />
              </h3>
              <p className="mt-2 text-small text-fg-2">
                <Copy simple={s.simple} technical={s.technical} />
                {"cite" in s && footnote(s.cite) > 0 && (
                  <>
                    {" "}
                    <a
                      href={`#fact-${footnote(s.cite)}`}
                      className="font-mono text-label text-fg-3 underline decoration-line-strong underline-offset-4"
                    >
                      [{footnote(s.cite)}]
                    </a>
                  </>
                )}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
