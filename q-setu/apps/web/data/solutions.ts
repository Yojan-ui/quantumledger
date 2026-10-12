/**
 * Sector solutions: shared by the home page's Solutions list and the /solutions/* pages. Workflows
 * are modelled on public Indian systems (UPI, ABDM, APAAR / DigiLocker) but every institution, person
 * and flow in the demos is fictional; Q-Setu has no integration with those systems today.
 */
export type SolutionId = "fintech" | "healthcare" | "education" | "government";

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
    dsa: ["Transaction signing and recurring mandates", "Statements and audit trails (Q-Ledger)"],
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
    demo: { href: "/demo/deploy", label: "Deploy Q-Setu across a payment network" },
    dataLifetime: "7–10 years (financial records)",
    impact:
      "Payment records stay sensitive for 7–10 years. Recorded today, they can still be worth reading when a quantum computer arrives.",
  },
  {
    id: "healthcare",
    name: "Healthcare",
    problem:
      "A diagnosis stays sensitive for a lifetime, so health-record exchanges are the clearest harvest-now target.",
    kem: [
      "Hospital-to-exchange transfers, via Shield",
      "Records at rest, each under its own ML-KEM-wrapped key (Vault)",
      "Bedside monitors and lab devices, via the Edge profile",
    ],
    dsa: ["Lab reports and prescriptions", "Consent artefacts"],
    flow: [
      { node: "Lab device", adapter: "Edge" },
      { node: "Hospital system", adapter: "Shield" },
      { node: "Health exchange", adapter: "Shield" },
      { node: "Records store", adapter: "Vault" },
    ],
    without: [
      ["Recorded transfers", "Diagnoses and IDs exposed decades later"],
      ["Backups", "One stolen copy is every record it holds"],
      ["Reports", "Signatures forgeable after Q-Day"],
    ],
    demo: { href: "/demo/qday", label: "Watch recorded lab reports open at Q-Day" },
    dataLifetime: "Lifetime of the patient",
    impact:
      "Health records need decades of secrecy. Without migration, today's records are readable within their lifetime.",
  },
  {
    id: "education",
    name: "Education",
    problem: "A degree is verified for forty years, so its signature has to outlive Q-Day.",
    kem: ["Student-data transfers between universities and registries"],
    dsa: [
      "University-signed certificates, verified from a QR code",
      "Transcripts and credit records",
    ],
    flow: [
      { node: "University", adapter: "SDK" },
      { node: "Credential registry", adapter: "Vault" },
      { node: "Employer's phone", adapter: "Web" },
    ],
    without: [
      ["Certificates", "Forged degrees with valid-looking signatures"],
      ["Student data", "Recorded transfers readable later"],
      ["Verification", "No way to tell a forgery after Q-Day"],
    ],
    demo: { href: "/demo/deploy", label: "Issue a certificate and forge it (it fails)" },
    dataLifetime: "40+ years (a career)",
    impact:
      "A degree has to stay provable for a whole career. Without post-quantum signatures, it becomes forgeable within that career.",
  },
  {
    id: "government",
    name: "Government",
    problem:
      "Identity, tax and land records are kept for decades and exchanged constantly between departments.",
    kem: [
      "Department-to-department APIs, via Shield (no code change to legacy systems)",
      "Citizen portals, via one script tag",
      "Archives, via Vault",
    ],
    dsa: ["Signed certificates, orders and records", "Tamper-evident audit logs (Q-Ledger)"],
    flow: [
      { node: "Citizen portal", adapter: "Web" },
      { node: "Department API", adapter: "Shield" },
      { node: "Records archive", adapter: "Vault" },
      { node: "Audit log", adapter: "Q-Ledger" },
    ],
    without: [
      ["Citizen data", "Recorded today, readable at Q-Day"],
      ["Audit trails", "Editable by an insider without a trace"],
      ["Inventory", "No map of where RSA and ECC are used"],
    ],
    demo: { href: "/demo/ledger", label: "Tamper with an audit log and get caught" },
    dataLifetime: "Decades (identity, land, tax)",
    impact:
      "Identity, land and tax records stay sensitive for decades. Without migration, records sent today outlive the locks that protect them.",
  },
];

export const solution = (id: string) => SOLUTIONS.find((s) => s.id === id);
