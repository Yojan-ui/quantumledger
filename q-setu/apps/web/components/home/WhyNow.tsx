import { Grid, Heading, Label, Reveal, Section, Text } from "@/components/ui";
import { SinceArrival } from "@/components/live/SinceArrival";
import { fact, footnote, type Fact } from "@/data/facts";

interface Moment {
  /** The big date, set at h1 size. */
  when: string;
  label: string;
  factId: string;
  /** Short line under the fact: what it means for India. */
  so: string;
}

const GLOBAL: Moment[] = [
  {
    when: "Today",
    label: "Harvest now, decrypt later",
    factId: "hndl",
    so: "Health records, identity, financial history and defence data must stay secret for 10+ years. Recorded today, they open later.",
  },
  {
    when: "Aug 2024",
    label: "The standards exist",
    factId: "fips",
    so: "There is no longer a reason to wait for the algorithms. What’s missing is a way to deploy them.",
  },
  {
    when: "2030 / 35",
    label: "The deadline is set",
    factId: "ir8547",
    so: "Systems that still depend on RSA or elliptic curves will be out of policy within a decade.",
  },
];

const INDIA: Moment[] = [
  {
    when: "2023",
    label: "India is building quantum capability",
    factId: "nqm",
    so: "A quantum-capable India needs quantum-safe infrastructure, built alongside it.",
  },
  {
    when: "24.07 bn",
    label: "India’s scale",
    factId: "upi",
    so: "Every one of those payments crosses networks that can be recorded today.",
  },
  {
    when: "Roadmap",
    label: "Indian guidance",
    factId: "in-roadmap",
    so: "National guidance points the same way: migrate to quantum-safe cryptography now.",
  },
];

function Column({ m, f, i }: { m: Moment; f: Fact; i: number }) {
  const n = footnote(f.id);
  return (
    <Reveal delay={i * 60} className="col-span-12 border-t border-line pt-8 md:col-span-4">
      <p className="tabular text-h1-sm font-medium text-fg md:text-h1">{m.when}</p>
      <Label as="h3" className="mt-4 block">
        {m.label}
      </Label>
      <Text className="mt-3">
        {f.claim}{" "}
        <a
          href={`#fact-${n}`}
          className="font-mono text-label text-fg-3 underline decoration-line-strong underline-offset-4"
        >
          [{n}]
        </a>
      </Text>
      <Text size="small" className="mt-3 text-fg-3">
        {m.so}
      </Text>
      {m.factId === "hndl" && <SinceArrival />}
    </Reveal>
  );
}

/** "Why now": a three-column timeline. Only verified facts appear; each links to its source. */
export function WhyNow() {
  const rows = [GLOBAL, INDIA].map((row) =>
    row.flatMap((m) => {
      const f = fact(m.factId);
      return f ? [{ m, f }] : [];
    }),
  );
  return (
    <Section id="why-now" index="02" label="Why now">
      <Heading className="max-w-text">
        The clock started before the quantum computer exists.
      </Heading>
      {rows.map(
        (row, r) =>
          row.length > 0 && (
            <div key={r} className="mt-16">
              {r === 1 && (
                <Label as="p" className="mb-6 block">
                  India
                </Label>
              )}
              <Grid className="gap-y-12">
                {row.map(({ m, f }, i) => (
                  <Column key={m.factId} m={m} f={f} i={i} />
                ))}
              </Grid>
            </div>
          ),
      )}
      <p className="mt-24 max-w-text text-h2 font-medium text-fg">
        The migration takes years. The data being stolen today needs protection today.
      </p>
    </Section>
  );
}
