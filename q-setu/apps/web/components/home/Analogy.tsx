"use client";

/**
 * Right after Join live: QuantumLedger as an everyday story in four steps, told by one 3D object
 * that morphs as you scroll. Locks → a future master key → thieves copying boxes now → new locks on
 * the same doors.
 */
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useMemo, useRef, useState } from "react";
import { Container, SectionLabel } from "@/components/ui";
import { Copy, CopyHeading } from "@/components/ui/Copy";
import { Term } from "@/components/ui/Term";
import { LazyView } from "@/components/scenes/LazyView";
import { footnote } from "@/data/facts";

const AnalogyMorph = dynamic(() => import("@/components/scenes/AnalogyMorph"), { ssr: false });

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
      "QuantumLedger adds a new kind of lock that the master key can't open, without rebuilding your systems.",
    technical: (
      <>
        QuantumLedger adds <Term id="hybrid">hybrid</Term> X25519 +{" "}
        <Term id="ml-kem">ML-KEM-768</Term> (FIPS 203) and <Term id="ml-dsa">ML-DSA</Term> (FIPS
        204) through five adapters, in front of systems that stay as they are.
      </>
    ),
    label: "The padlock becomes a lattice lock",
  },
] as const;

/**
 * A pinned sequence: one large object on the left morphs lock → master key → copied boxes → lattice
 * lock as you scroll, and the four cards slide sideways on the right, one per shape.
 */
export function Analogy({ index }: { index: string }) {
  const ref = useRef<HTMLElement>(null);
  const progress = useMemo(() => ({ v: 0 }), []);
  const [step, setStep] = useState(0);
  const [reduce, setReduce] = useState(false);
  useEffect(() => setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
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
          progress.v = st.progress * 3;
          const i = Math.min(3, Math.round(st.progress * 3));
          setStep((s) => (s === i ? s : i));
        },
      });
    }, el);
    return () => ctx.revert();
  }, [progress]);
  return (
    <section
      ref={ref}
      id="analogy"
      className="relative scroll-mt-14"
      style={{ height: `${STEPS.length * 80}vh` }}
      data-tour="analogy"
    >
      <div className="sticky top-14 h-story overflow-hidden">
        <Container className="grid h-full grid-cols-12 content-center gap-x-6 gap-y-6">
          <div className="col-span-12 md:col-span-6">
            <LazyView className="h-globe w-full md:h-stage" label={STEPS[step]!.label}>
              {(on) => <AnalogyMorph progress={progress} active={on} reduce={reduce} />}
            </LazyView>
          </div>
          <div className="col-span-12 md:col-span-5 md:col-start-8">
            <SectionLabel index={index} label="In four steps" role="kem" />
            <CopyHeading
              simple="Why your data needs new locks."
              technical="The quantum threat, and the fix, in four steps."
              className="max-w-text"
            />
            <div className="mt-10 overflow-hidden">
              <ol
                className="flex transition-transform duration-700 ease-ease"
                style={{ transform: `translate3d(${-step * 100}%, 0, 0)` }}
              >
                {STEPS.map((s, i) => (
                  <li
                    key={i}
                    aria-current={i === step || undefined}
                    className={`w-full shrink-0 pr-6 transition-opacity duration-700 ${i === step ? "opacity-100" : "opacity-0"}`}
                  >
                    <p className="font-mono text-label uppercase text-fg-3">
                      0{i + 1} / 0{STEPS.length}
                    </p>
                    <h3 className="mt-2 text-h3 font-medium text-fg">
                      <Copy simple={s.title.simple} technical={s.title.technical} />
                    </h3>
                    <p className="mt-3 text-body text-fg-2">
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
            </div>
            <div className="mt-8 flex gap-2" aria-hidden>
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`block h-1 rounded-full transition duration-300 ${i === step ? "w-8 bg-kem" : "w-3 bg-line-strong"}`}
                />
              ))}
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
