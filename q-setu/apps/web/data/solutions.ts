/**
 * Sector solutions: shared by the home page's Solutions list and the /solutions/* pages. Workflows
 * are modelled on public Indian systems (UPI) but every institution, person
 * and flow in the demos is fictional; QuantumLedger has no integration with those systems today.
 */
export type SolutionId = "fintech";

export interface Solution {
  id: SolutionId;
  name: string;
  /** One sentence: why this sector should care now. */
  problem: string;
  /** Where hybrid ML-KEM (FIPS 203) protects data in transit or at rest. */
  kem: string[];
  /** Where ML-DSA (FIPS 204) signs things that must stay provable. */
  dsa: string[];
  /** Workflow diagram: the hops one record takes, and the adapter on each hop. */
  flow: { node: string; adapter: string }[];
  without: [string, string][];
  /** Demo that shows this sector, and the sector key the simulator uses (if any). */
  demo: { href: string; label: string };
  dataLifetime: string;
  /** The page's closing line: what happens without migration, in this sector's own terms. */
  impact: string;
}

export const SOLUTIONS: Solution[] = [
  {
    id: "fintech",
    name: "Fintech",
    problem:
      "Payment and banking traffic recorded today stays valuable for years, and mandates must stay unforgeable.",
    kem: [
      "Bank-to-switch and switch-to-bank links, via Shield in front of existing cores",
      "Mobile banking APIs, via the SDK",
      "Net-banking forms, via one script tag",
    ],
    dsa: [
      "Transaction signing and recurring mandates",
      "Statements and audit trails (Proof Chain)",
    ],
    flow: [
      { node: "Payer app", adapter: "SDK" },
      { node: "Payer bank", adapter: "Shield" },
      { node: "Payment switch", adapter: "Shield" },
      { node: "Payee bank", adapter: "Vault" },
    ],
    without: [
      ["Recorded payments", "Readable at Q-Day: names, VPAs, amounts"],
      ["Mandates and signatures", "Forgeable once RSA and ECDSA fall"],
      ["Migration", "Rewrite each core's crypto, system by system"],
    ],
    demo: { href: "/demo/deploy", label: "Deploy QuantumLedger across a payment network" },
    dataLifetime: "7–10 years (financial records)",
    impact:
      "Payment records stay sensitive for years. Recorded today, they can still be worth reading when a quantum computer arrives.",
  },
];

export const solution = (id: string) => SOLUTIONS.find((s) => s.id === id);
