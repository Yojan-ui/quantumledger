/**
 * Customers: who owns which protected site, who may sign in to see it, and the team's note and
 * readiness score for them. This is account data, not evidence: it is a plain JSON file next to the
 * records, it can change, and it is not signed.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

export interface Customer {
  id: string;
  name: string;
  /** The site id the recorder writes on this customer's events. */
  site: string;
  /** Who may sign in as this customer (lower case). */
  emails: string[];
  /** The team's note for this customer, shown only to them and the team. */
  note: string;
  /** The team's readiness score, 0–100, or null if not scored yet. */
  readiness: number | null;
  /** The matching Shield site on the website, for its quantum-safe share. */
  shieldSiteId?: string;
  updatedAt?: number;
  updatedBy?: string;
}

export type CustomerPatch = Partial<Pick<Customer, "note" | "readiness" | "shieldSiteId">>;

/** Two fictional demo customers, so the lab has more than one scope out of the box. */
export const DEMO_CUSTOMERS: Customer[] = [
  {
    id: "ledgerwood",
    name: "Ledgerwood Co-operative Bank",
    site: "ledgerwood-bank",
    emails: ["ciso@ledgerwood.example"],
    note: "",
    readiness: null,
  },
  {
    id: "sahyadri",
    name: "Sahyadri Clinic",
    site: "sahyadri-clinic",
    emails: ["it@sahyadri.example"],
    note: "",
    readiness: null,
  },
];

export class CustomerRegistry {
  private customers: Customer[];

  constructor(
    private readonly file?: string,
    seed: Customer[] = DEMO_CUSTOMERS,
  ) {
    this.customers =
      file && existsSync(file)
        ? (JSON.parse(readFileSync(file, "utf8")) as Customer[])
        : structuredClone(seed);
    if (file && !existsSync(file)) this.save();
  }

  private save() {
    if (!this.file) return;
    writeFileSync(`${this.file}.tmp`, JSON.stringify(this.customers, null, 2));
    renameSync(`${this.file}.tmp`, this.file);
  }

  list(): Customer[] {
    return structuredClone(this.customers);
  }

  get(id: string): Customer | undefined {
    const c = this.customers.find((x) => x.id === id);
    return c && structuredClone(c);
  }

  sites(): string[] {
    return this.customers.map((c) => c.site);
  }

  /** Validates and applies the team's edit. Returns the customer, or an error message. */
  update(id: string, patch: CustomerPatch, by: string): Customer | string {
    const c = this.customers.find((x) => x.id === id);
    if (!c) return "No such customer";
    if (patch.note !== undefined) {
      if (typeof patch.note !== "string" || patch.note.length > 2000)
        return "The note must be text, at most 2000 characters";
      c.note = patch.note.trim();
    }
    if (patch.readiness !== undefined) {
      const r = patch.readiness;
      if (r !== null && (!Number.isInteger(r) || r < 0 || r > 100))
        return "Readiness must be a whole number from 0 to 100, or empty";
      c.readiness = r;
    }
    if (patch.shieldSiteId !== undefined) {
      if (typeof patch.shieldSiteId !== "string" || patch.shieldSiteId.length > 64)
        return "The Shield site id must be at most 64 characters";
      c.shieldSiteId = patch.shieldSiteId.trim() || undefined;
    }
    c.updatedAt = Date.now();
    c.updatedBy = by.slice(0, 200);
    this.save();
    return structuredClone(c);
  }
}
