/**
 * The three demo sectors. Each has a three-node path and a payload generator. All names, IDs and
 * institutions are fictional; ID formats only resemble UPI / ABHA / APAAR.
 */

export type SectorId = "fintech" | "healthcare" | "education";

export interface Sector {
  id: SectorId;
  label: string;
  nodes: [string, string, string];
  /** What one record is called ("payment", "lab report", ...). */
  noun: string;
  generate(): Record<string, string>;
  /** What an attacker learns once a record is decrypted. */
  reveal(p: Record<string, string>): { headline: string; detail: string };
}

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!;
const digits = (n: number) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
let seq = 0;
const id = (prefix: string) =>
  `${prefix}${Date.now().toString().slice(-6)}${String(++seq % 1000).padStart(3, "0")}`;

const FIRST = [
  "Ravi",
  "Priya",
  "Arjun",
  "Fatima",
  "Sandeep",
  "Meera",
  "Rahul",
  "Kavya",
  "Imran",
  "Neha",
  "Anjali",
  "Vikram",
  "Lakshmi",
  "Deepa",
  "Suresh",
];
const LAST = [
  "Kumar",
  "Sharma",
  "Reddy",
  "Khan",
  "Singh",
  "Iyer",
  "Verma",
  "Nair",
  "Sheikh",
  "Gupta",
  "Menon",
  "Patil",
  "Rao",
];
const name = () => `${pick(FIRST)} ${pick(LAST)}`;
const inr = (v: number) =>
  `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const SECTORS: Record<SectorId, Sector> = {
  fintech: {
    id: "fintech",
    label: "Fintech",
    nodes: ["Bharat Bank", "UPI Switch", "Sahyadri Bank"],
    noun: "payment",
    generate() {
      const r = Math.random();
      const amount =
        r < 0.6
          ? 20 + Math.random() * 480
          : r < 0.9
            ? 500 + Math.random() * 4500
            : 5000 + Math.random() * 45000;
      const payer = name().toLowerCase().replace(" ", ".");
      const payee = pick([
        "anjali.menon",
        "dmart.thane",
        "chai.point",
        "suresh.kirana",
        "deepa.tuition",
        "jio.recharge",
      ]);
      return {
        recordId: id("TXN"),
        payerVPA: `${payer}@bharatbank`,
        payeeVPA: `${payee}@sahyadri`,
        amountINR: amount.toFixed(2),
        note: pick(["Rent share", "Groceries", "Electricity bill", "Tuition fees", "Medicines"]),
      };
    },
    reveal: (p) => ({
      headline: `${inr(Number(p.amountINR))}  ${p.payerVPA} → ${p.payeeVPA}`,
      detail: p.note ?? "",
    }),
  },
  healthcare: {
    id: "healthcare",
    label: "Healthcare",
    nodes: ["Pune General Hospital", "Health Exchange", "Sahyadri Clinic"],
    noun: "lab report",
    generate() {
      const [test, result, diagnosis] = pick([
        ["HbA1c", "7.9 %", "Type 2 diabetes"],
        ["HIV-1/2 antibody", "Reactive", "HIV positive"],
        ["TSH", "8.4 mIU/L", "Hypothyroidism"],
        ["Hepatitis B sAg", "Positive", "Chronic hepatitis B"],
        ["Lipid panel", "LDL 182 mg/dL", "Hyperlipidaemia"],
      ] as const);
      return {
        recordId: id("LAB"),
        patientName: name(),
        healthId: `91-${digits(4)}-${digits(4)}-${digits(4)}`,
        test,
        result,
        diagnosis,
        orderedBy: `Dr. ${name()}`,
      };
    },
    reveal: (p) => ({
      headline: `${p.patientName} · ${p.diagnosis}`,
      detail: `${p.test}: ${p.result} · ID ${p.healthId}`,
    }),
  },
  education: {
    id: "education",
    label: "Education",
    nodes: ["Deccan University", "Credential Registry", "Employer"],
    noun: "certificate",
    generate() {
      return {
        recordId: id("CERT"),
        studentName: name(),
        studentId: `APR${digits(9)}`,
        degree: pick([
          "B.Tech Computer Science",
          "B.Com",
          "M.Sc Physics",
          "MBBS",
          "B.A. Economics",
        ]),
        grade: pick(["CGPA 9.1", "CGPA 7.4", "First Class", "CGPA 6.2", "Distinction"]),
        year: String(2020 + Math.floor(Math.random() * 6)),
      };
    },
    reveal: (p) => ({
      headline: `${p.studentName} · ${p.grade}`,
      detail: `${p.degree}, ${p.year} · ${p.studentId}`,
    }),
  },
};

export const SECTOR_IDS = Object.keys(SECTORS) as SectorId[];
export const isSectorId = (s: string): s is SectorId => Object.hasOwn(SECTORS, s);
