/**
 * Every factual claim the site makes, with its source. Only facts with `verified: true` are shown.
 *
 * `verified` means someone read the claim in the primary source (`url`) and it matched. Facts that
 * were only found in secondary reporting stay `verified: false` until the team checks them; the
 * `check` note says where. Re-check everything the week of the event and update `asOf`.
 */
export interface Fact {
  id: string;
  /** One sentence, as the site shows it. */
  claim: string;
  source: string;
  url: string;
  /** Date of the source's data (YYYY-MM or YYYY-MM-DD). */
  asOf: string;
  verified: boolean;
  /** What was checked and when, or what still needs checking. */
  check: string;
  /** Optional headline number (animated) for stat rows. */
  stat?: { num: number; decimals: number; unit: string; label: string };
  /** A numeric range the site computes with (e.g. Mosca's Z), taken from the claim above. */
  range?: { low: number; high: number; unit: string; label: string };
}

export const FACTS: Fact[] = [
  // ── Why now ─────────────────────────────────────────────────────────────────────────────
  {
    id: "hndl",
    claim:
      "Adversaries can record encrypted traffic today and decrypt it once a large quantum computer exists, so data that must stay secret for years is already at risk.",
    source: "UK NCSC, “Next steps in preparing for post-quantum cryptography”",
    url: "https://www.ncsc.gov.uk/whitepaper/next-steps-preparing-for-post-quantum-cryptography",
    asOf: "2023-11",
    verified: true,
    check:
      "Read 2026-10-11: “there is a risk from an attacker collecting and storing data today and decrypting it at some point in the future.”",
  },
  {
    id: "fips",
    claim:
      "NIST published the first post-quantum standards: FIPS 203 (ML-KEM), FIPS 204 (ML-DSA) and FIPS 205 (SLH-DSA).",
    source: "NIST news release, 13 August 2024",
    url: "https://www.nist.gov/news-events/news/2024/08/nist-releases-first-3-finalized-post-quantum-encryption-standards",
    asOf: "2024-08-13",
    verified: true,
    check: "Read 2026-10-11 on nist.gov.",
  },
  {
    id: "ir8547",
    claim:
      "NIST’s draft transition plan proposes deprecating 112-bit RSA and elliptic-curve algorithms after 2030 and disallowing all of them after 2035.",
    source: "NIST IR 8547 (Initial Public Draft), November 2024, Tables 2–4",
    url: "https://csrc.nist.gov/pubs/ir/8547/ipd",
    asOf: "2024-11-12",
    verified: true,
    check:
      "Read 2026-10-11 in the draft PDF. CSRC still lists it as an Initial Public Draft (no final version), so always call it a draft.",
  },
  {
    id: "crqc-timeline",
    claim:
      "In an expert survey, a cryptographically relevant quantum computer is judged quite possible (28–49%) within 10 years and likely (51–70%) within 15.",
    source:
      "Global Risk Institute, Quantum Threat Timeline Report 2025 (Mosca & Piani), 26 experts",
    url: "https://globalriskinstitute.org/publication/quantum-threat-timeline-report-2025b/",
    asOf: "2026-03-09",
    verified: true,
    // "Quite possible within 10 years, likely within 15": Mosca's Z as 10–15 years from the report.
    range: { low: 10, high: 15, unit: "years", label: "estimated years until a CRQC" },
    check:
      "Read 2026-10-12 on globalriskinstitute.org: “a cryptographically relevant quantum computer (CRQC) quite possible (28-49%) within the next 10 years … likely (51-70%) in the next 15.” An expert-opinion survey, not a forecast of a device: always call it an estimate.",
  },
  {
    id: "nqm",
    claim:
      "The Union Cabinet approved the National Quantum Mission in April 2023, at ₹6,003.65 crore from 2023-24 to 2030-31.",
    source: "Cabinet decision, PIB / Department of Science & Technology",
    url: "https://dst.gov.in/cabinet-approves-national-quantum-mission-scale-scientific-industrial-rd-quantum-technologies",
    asOf: "2023-04-19",
    verified: true,
    check:
      "Text confirmed 2026-10-11 from the official release as indexed on dst.gov.in and pmindia.gov.in (the pages block automated fetches). Re-open in a browser before the event.",
    stat: {
      num: 6003.65,
      decimals: 2,
      unit: " cr",
      label: "₹ for the National Quantum Mission, 2023-31",
    },
  },
  {
    id: "upi",
    claim: "UPI processed 24.07 billion transactions in September 2026.",
    source: "NPCI monthly statistics, as reported by DD India and others",
    url: "https://www.npci.org.in/what-we-do/upi/product-statistics",
    asOf: "2026-09",
    verified: false,
    check:
      "Several outlets agree (24.07 bn, released 1 Oct 2026), but NPCI's statistics page could not be read automatically. Open it in a browser, confirm the September figure, then set verified: true.",
    stat: { num: 24.07, decimals: 2, unit: " bn", label: "UPI transactions in September 2026" },
  },
  {
    id: "in-roadmap",
    claim:
      "A National Quantum Mission task force has published a roadmap for India’s migration to quantum-safe cryptography.",
    source: "DST, “Quantum-Safe Ecosystem in India” task-force report",
    url: "https://dst.gov.in/news/report-implementation-quantum-safe-ecosystem-india",
    asOf: "2026-02",
    verified: false,
    check:
      "Reported by The Quantum Insider and ORF; the DST page and PDF could not be opened. Only show it after reading the official document, and quote its own timelines.",
  },
];

/** The facts the site may show, in order. Footnote numbers follow this list. */
export const SHOWN = FACTS.filter((f) => f.verified);

export const fact = (id: string): Fact | undefined => SHOWN.find((f) => f.id === id);

/** 1-based footnote number of a shown fact (0 if hidden). */
export const footnote = (id: string): number => SHOWN.findIndex((f) => f.id === id) + 1;

/** Footnotes after the facts: the live benchmark, then the globe's map data. */
export const BENCH_NOTE = SHOWN.length + 1;
export const MAP_NOTE = SHOWN.length + 2;
