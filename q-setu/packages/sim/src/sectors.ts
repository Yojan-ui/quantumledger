/**
 * The banking demo sector. Each has a three-node path and a payload generator. All names, IDs and
 * institutions are fictional; ID formats only resemble UPI.
 */

export type SectorId = "fintech";

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
};

export const SECTOR_IDS = Object.keys(SECTORS) as SectorId[];
export const isSectorId = (s: string): s is SectorId => Object.hasOwn(SECTORS, s);
