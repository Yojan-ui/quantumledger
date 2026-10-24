/**
 * Saved site scans, per customer workspace: what was checked, when, and the headline findings, so a
 * workspace's overview can list its own scans. Plain JSON next to the evidence, bounded per
 * workspace; these are notes about public information, not signed evidence.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

export interface SavedScan {
  id: string;
  customerId: string;
  at: number;
  by: string;
  input: string;
  kind: "website" | "email" | "error";
  /** The scan's full result as the website returned it (public findings only). */
  result: unknown;
}

const PER_WORKSPACE = 50;

export class ScanStore {
  private scans: SavedScan[];
  constructor(private readonly file?: string) {
    this.scans =
      file && existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as SavedScan[]) : [];
  }

  private save() {
    if (!this.file) return;
    writeFileSync(`${this.file}.tmp`, JSON.stringify(this.scans));
    renameSync(`${this.file}.tmp`, this.file);
  }

  add(s: Omit<SavedScan, "id" | "at">): SavedScan {
    const rec: SavedScan = {
      ...s,
      id: `sc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      at: Date.now(),
    };
    this.scans.push(rec);
    const mine = this.scans.filter((x) => x.customerId === s.customerId);
    if (mine.length > PER_WORKSPACE) {
      const drop = new Set(mine.slice(0, mine.length - PER_WORKSPACE).map((x) => x.id));
      this.scans = this.scans.filter((x) => !drop.has(x.id));
    }
    this.save();
    return rec;
  }

  /** Newest first; one workspace, or every workspace when `customerId` is undefined. */
  list(customerId?: string, limit = 20): SavedScan[] {
    return this.scans
      .filter((s) => customerId === undefined || s.customerId === customerId)
      .slice(-limit)
      .reverse();
  }
}
