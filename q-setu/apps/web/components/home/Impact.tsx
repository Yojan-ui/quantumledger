"use client";

/**
 * Impact calculator. Pick a sector, roughly how many records and how long they must stay secret: a
 * timeline shows today → "secret until" against the quantum risk window (2030–2035+, from NIST's
 * draft transition plan, IR 8547), the years of exposure Q-Setu prevents, and the migration effort
 * with and without Q-Setu for that sector's adapter. Every assumption is labelled and editable.
 */
import { useId, useMemo, useState } from "react";
import { Container, SectionLabel } from "@/components/ui";
import { Copy, CopyHeading } from "@/components/ui/Copy";
import { Term } from "@/components/ui/Term";
import { fact, footnote } from "@/data/facts";

const NOW = new Date().getFullYear();
/** NIST IR 8547 (draft): 112-bit RSA/ECC deprecated after 2030, all disallowed after 2035. */
const RISK_FROM = 2030;
const RISK_TO = 2035;

/**
 * Per sector: a typical secrecy period (an estimate; records differ) and the adapter that usually
 * fits. Effort defaults are assumptions, shown as such and editable.
 */
const SECTORS = {
  banking: {
    label: "Banking and payments",
    years: 10,
    adapter: "Shield",
    how: "a sidecar proxy in front of each core or API, no code change",
    plain: "one small program placed in front of each system, with no changes to the system itself",
  },
  healthcare: {
    label: "Healthcare",
    years: 30,
    adapter: "Vault",
    how: "a per-record key wrapped with ML-KEM, one call where records are stored",
    plain: "every record gets its own quantum-safe lock where it is stored, with one line of code",
  },
  government: {
    label: "Government services",
    years: 25,
    adapter: "Web",
    how: "one script tag per citizen-facing site",
    plain: "one line added to each public website",
  },
  education: {
    label: "Education",
    years: 40,
    adapter: "SDK",
    how: "signed certificates through the SDK, in the issuing app",
    plain: "certificates signed with a quantum-safe signature by the app that issues them",
  },
  telecom: {
    label: "Telecom",
    years: 5,
    adapter: "Edge",
    how: "the Edge profile on gateways and devices",
    plain: "a lightweight version for small devices and network gateways",
  },
} as const;
type SectorId = keyof typeof SECTORS;

const fmt = (n: number) => n.toLocaleString("en-IN");

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  note,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  note?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      <span className="font-mono text-label uppercase text-fg-3">{label}</span>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="mt-2 h-10 w-full rounded-sm border border-line bg-inset px-3 font-mono text-body text-fg focus:border-line-strong focus:outline-none"
      />
      {note && <span className="mt-1 block text-small text-fg-3">{note}</span>}
    </label>
  );
}

export function Impact({ index }: { index: string }) {
  const [sector, setSector] = useState<SectorId>("healthcare");
  const [records, setRecords] = useState(1_000_000);
  const [years, setYears] = useState<number>(SECTORS.healthcare.years);
  const [systems, setSystems] = useState(12);
  // Assumptions (engineer-weeks): migrating one system's crypto in code vs deploying an adapter.
  const [codeWeeks, setCodeWeeks] = useState(8);
  const [adapterWeeks, setAdapterWeeks] = useState(0.5);
  const s = SECTORS[sector];
  const until = NOW + years;
  const n = footnote("ir8547");

  const { worst, best, end } = useMemo(() => {
    // Exposure: the years between Q-Day and the end of the secrecy period. Q-Day anywhere in the
    // window gives a range: it arrives at the window's start (worst) or end (best).
    const worst = Math.max(0, until - RISK_FROM);
    const best = Math.max(0, until - RISK_TO);
    return { worst, best, end: Math.max(until, RISK_TO + 5, NOW + 15) };
  }, [until]);
  const span = end - NOW;
  const x = (y: number) => `${((Math.min(end, Math.max(NOW, y)) - NOW) / span) * 100}%`;
  const without = systems * codeWeeks;
  const withQ = systems * adapterWeeks;

  return (
    <section id="impact" className="relative scroll-mt-14 py-24 md:py-40" data-tour="impact">
      <Container>
        <SectionLabel index={index} label="Impact" role="warn" />
        <CopyHeading
          simple="How long must your records stay secret?"
          technical="Secrecy lifetime against the quantum risk window."
          className="max-w-text"
        />
        <div className="mt-12 grid grid-cols-12 gap-x-6 gap-y-10">
          <form
            className="col-span-12 space-y-5 md:col-span-4"
            onSubmit={(e) => e.preventDefault()}
            aria-label="Your records"
          >
            <label className="block">
              <span className="font-mono text-label uppercase text-fg-3">Your sector</span>
              <select
                value={sector}
                onChange={(e) => {
                  const id = e.target.value as SectorId;
                  setSector(id);
                  setYears(SECTORS[id].years);
                }}
                className="mt-2 h-10 w-full rounded-sm border border-line bg-inset px-3 text-body text-fg focus:border-line-strong focus:outline-none"
              >
                {Object.entries(SECTORS).map(([id, v]) => (
                  <option key={id} value={id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <NumberField
              label="Records, roughly"
              value={records}
              onChange={setRecords}
              min={1}
              max={10_000_000_000}
              step={1000}
            />
            <NumberField
              label="Years they must stay secret"
              value={years}
              onChange={setYears}
              min={1}
              max={100}
              note={`Estimate: ${s.years} years is a typical default for ${s.label.toLowerCase()}. Use your own retention rules.`}
            />
            <NumberField
              label="Systems that handle them"
              value={systems}
              onChange={setSystems}
              min={1}
              max={10_000}
            />
          </form>

          <div className="col-span-12 md:col-span-8" aria-live="polite">
            {/* Timeline: today → secret until, against the shaded risk window. */}
            <div
              className="relative h-24"
              role="img"
              aria-label={`Secret from ${NOW} until ${until}; quantum risk window ${RISK_FROM}–${RISK_TO} and after`}
            >
              <div
                className="absolute inset-y-0 rounded-sm bg-warn opacity-10"
                style={{ left: x(RISK_FROM), right: 0 }}
              />
              <div
                className="absolute inset-y-0 rounded-sm bg-warn opacity-20"
                style={{ left: x(RISK_FROM), width: `calc(${x(RISK_TO)} - ${x(RISK_FROM)})` }}
              />
              <span
                className="absolute top-1 font-mono text-label uppercase text-warn"
                style={{ left: `calc(${x(RISK_FROM)} + 8px)` }}
              >
                Quantum risk window {RISK_FROM}–{RISK_TO}+{" "}
                <a href={`#fact-${n}`} className="text-fg-3 underline underline-offset-4">
                  [{n}]
                </a>
              </span>
              <div
                className="absolute top-10 h-3 rounded-full bg-kem transition-all duration-300"
                style={{ left: 0, width: x(until) }}
              />
              {worst > 0 && (
                <div
                  className="absolute top-10 h-3 rounded-full bg-danger transition-all duration-300"
                  style={{ left: x(RISK_FROM), width: `calc(${x(until)} - ${x(RISK_FROM)})` }}
                />
              )}
              <span className="absolute bottom-0 left-0 font-mono text-label text-fg-3">
                Today · {NOW}
              </span>
              <span
                className="absolute bottom-0 -translate-x-full whitespace-nowrap font-mono text-label text-fg"
                style={{ left: x(until) }}
              >
                Secret until {until}
              </span>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 border-t border-line pt-8 md:grid-cols-2">
              <div>
                <p className="font-mono text-h1-sm text-fg" data-impact-exposure>
                  {worst === 0
                    ? "0 years"
                    : best === worst
                      ? `${worst} years`
                      : `${best}–${worst} years`}
                </p>
                <p className="mt-2 text-small text-fg-2">
                  <Copy
                    simple={
                      worst === 0
                        ? "Your records stop needing secrecy before the risk window opens. Keep an eye on it anyway."
                        : `of exposure Q-Setu prevents: ${fmt(records)} records would still need to be secret after a quantum computer could open them.`
                    }
                    technical={
                      worst === 0 ? (
                        "Secrecy ends before 2030: harvest-now-decrypt-later exposure is low."
                      ) : (
                        <>
                          of exposure prevented: {fmt(records)} records recorded today stay
                          sensitive after <Term id="q-day">Q-Day</Term> if it lands between{" "}
                          {RISK_FROM} and {RISK_TO}.
                        </>
                      )
                    }
                  />
                </p>
                <p className="mt-2 font-mono text-label uppercase text-fg-3">
                  Estimate · Q-Day&apos;s date is unknown
                </p>
              </div>
              <div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2" data-impact-effort>
                  <dt className="text-small text-fg-2">Without Q-Setu</dt>
                  <dd className="text-right font-mono text-small text-fg">
                    ≈ {fmt(Math.round(without))} engineer-weeks
                  </dd>
                  <dt className="text-small text-fg-2">
                    With Q-Setu <span data-copy="technical">{s.adapter}</span>
                  </dt>
                  <dd className="text-right font-mono text-small text-ok">
                    ≈ {fmt(Math.round(withQ * 10) / 10)} engineer-weeks
                  </dd>
                </dl>
                <p className="mt-3 text-small text-fg-2">
                  <Copy
                    simple={`Without Q-Setu, each of your ${systems} systems has its locks rebuilt by hand. With it: ${s.plain}.`}
                    technical={`Without: change, test and redeploy the cryptography in each of ${systems} systems. With Q-Setu ${s.adapter}: ${s.how}.`}
                  />
                </p>
                <details className="mt-3">
                  <summary className="cursor-pointer font-mono text-label uppercase text-fg-3">
                    Estimate · assumptions (edit)
                  </summary>
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <NumberField
                      label="Weeks per system, in code"
                      value={codeWeeks}
                      onChange={setCodeWeeks}
                      min={0.5}
                      max={104}
                      step={0.5}
                    />
                    <NumberField
                      label="Weeks per system, adapter"
                      value={adapterWeeks}
                      onChange={setAdapterWeeks}
                      min={0.1}
                      max={52}
                      step={0.1}
                    />
                  </div>
                  <p className="mt-2 text-small text-fg-3">
                    Our assumptions, not measurements: a code migration means inventory, library
                    changes, testing and redeploying each system; an adapter deployment means
                    configuration and testing. Change them to your own.
                  </p>
                </details>
              </div>
            </div>
            {fact("ir8547") && (
              <p className="mt-8 text-small text-fg-3">
                Risk window: NIST IR 8547 (initial public draft, Nov 2024) proposes deprecating RSA
                and elliptic-curve algorithms after {RISK_FROM} and disallowing them after {RISK_TO}
                . It is a draft and a policy deadline, not a prediction of when a quantum computer
                will exist.
              </p>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
