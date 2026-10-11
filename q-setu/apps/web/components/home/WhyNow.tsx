import { SinceArrival } from "@/components/live/SinceArrival";
import { Grid, Label, Reveal, Section, Text } from "@/components/ui";
import { MaskHeading } from "@/components/ui/MaskHeading";
import { fact, footnote } from "@/data/facts";

/** Short forms of verified facts (the full claim and source are in the footer, by footnote). */
export const MOMENTS = [
  {
    when: "Today",
    label: "Harvest now, decrypt later",
    factId: "hndl",
    text: "Encrypted traffic recorded today can be decrypted once a large quantum computer exists.",
  },
  {
    when: "Aug 2024",
    label: "The standards exist",
    factId: "fips",
    text: "NIST published the post-quantum standards: ML-KEM, ML-DSA and SLH-DSA.",
  },
  {
    when: "2030 / 35",
    label: "The deadline is set",
    factId: "ir8547",
    text: "NIST’s draft plan deprecates RSA and elliptic curves after 2030 and disallows them after 2035.",
  },
  {
    when: "2023",
    label: "India is building quantum capability",
    factId: "nqm",
    text: "The National Quantum Mission was approved at ₹6,003.65 crore, running to 2030-31.",
  },
  {
    when: "24.07 bn",
    label: "India’s scale",
    factId: "upi",
    text: "UPI transactions in September 2026, each crossing networks that can be recorded.",
  },
];

/** 03: why should I care today? Only verified facts appear, each footnoted to its source. */
export function WhyNow() {
  const shown = MOMENTS.filter((m) => fact(m.factId));
  return (
    <Section id="why-now" index="03" label="Why now">
      <MaskHeading
        text="The clock started before the quantum computer exists."
        className="max-w-text"
      />
      <Grid className="mt-16 gap-y-12">
        {shown.map((m, i) => {
          const n = footnote(m.factId);
          return (
            <Reveal
              key={m.factId}
              delay={(i % 3) * 60}
              className="col-span-12 border-t border-line pt-8 md:col-span-6 lg:col-span-4"
            >
              <p className="tabular text-h1-sm font-medium text-fg md:text-h1">{m.when}</p>
              <Label as="h3" className="mt-4 block">
                {m.label}
              </Label>
              <Text className="mt-3">
                {m.text}{" "}
                <a
                  href={`#fact-${n}`}
                  className="font-mono text-label text-fg-3 underline decoration-line-strong underline-offset-4"
                >
                  [{n}]
                </a>
              </Text>
              {m.factId === "hndl" && <SinceArrival />}
            </Reveal>
          );
        })}
      </Grid>
      <p className="mt-24 max-w-text text-h2 font-medium text-fg">
        The migration takes years. The data being stolen today needs protection today.
      </p>
    </Section>
  );
}
