/**
 * Q-Ledger: an append-only, tamper-evident audit log in SQLite.
 *
 *   hash_n = SHA3-256("qledger-v1" ‖ id ‖ at ‖ kind ‖ subject ‖ payload ‖ hash_{n-1} ‖ key_id)
 *   sig_n  = ML-DSA-65(hash_n)            (the signing key comes from the KMS and rotates)
 *
 * Editing any row changes its hash, which no longer matches the stored hash or the next row's
 * `prev`; re-computing the hash doesn't help without the ledger's signing key. `verify()` walks the
 * whole chain and names the first entry that fails, and why.
 */
import Database from "better-sqlite3";
import { sha3_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, encodeParts, getSig, hexToBytes, utf8ToBytes, type SigId } from "@qsetu/core";

function u64(n: number): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(n));
  return b;
}

export interface LedgerSigner {
  /** The key that will sign the next entry. */
  current(): { keyId: string; alg: SigId };
  sign(message: Uint8Array): { signature: Uint8Array; keyId: string; alg: SigId };
  publicKey(keyId: string): { alg: SigId; publicKey: Uint8Array } | undefined;
}

export interface LedgerEntry {
  id: number;
  at: number;
  kind: string;
  subject: string;
  payload: Record<string, unknown>;
  prev: string;
  hash: string;
  sig: string;
  keyId: string;
  alg: string;
}

export type BreakReason =
  "payload-modified" | "chain-broken" | "bad-signature" | "unknown-key" | "missing-entry";

export interface VerifyResult {
  ok: boolean;
  checked: number;
  ms: number;
  head: string;
  broken?: { id: number; reason: BreakReason; detail: string; expected?: string; actual?: string };
}

const GENESIS = "0".repeat(64);

interface Row {
  id: number;
  at: number;
  kind: string;
  subject: string;
  payload: string;
  prev: string;
  hash: string;
  sig: string;
  key_id: string;
  alg: string;
}

export function entryHash(
  r: Pick<Row, "id" | "at" | "kind" | "subject" | "payload" | "prev" | "key_id">,
): string {
  return bytesToHex(
    sha3_256(
      encodeParts(
        utf8ToBytes("qledger-v1"),
        u64(r.id),
        u64(r.at),
        utf8ToBytes(r.kind),
        utf8ToBytes(r.subject),
        utf8ToBytes(r.payload),
        hexToBytes(r.prev),
        utf8ToBytes(r.key_id),
      ),
    ),
  );
}

const toEntry = (r: Row): LedgerEntry => ({
  id: r.id,
  at: r.at,
  kind: r.kind,
  subject: r.subject,
  payload: JSON.parse(r.payload) as Record<string, unknown>,
  prev: r.prev,
  hash: r.hash,
  sig: r.sig,
  keyId: r.key_id,
  alg: r.alg,
});

export class Ledger {
  readonly db: Database.Database;
  private readonly listeners = new Set<(e: LedgerEntry, ms: number) => void>();

  constructor(
    file: string,
    private readonly signer: LedgerSigner,
    private readonly now: () => number = Date.now,
  ) {
    this.db = new Database(file);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY, at INTEGER NOT NULL, kind TEXT NOT NULL, subject TEXT NOT NULL,
        payload TEXT NOT NULL, prev TEXT NOT NULL, hash TEXT NOT NULL, sig TEXT NOT NULL,
        key_id TEXT NOT NULL, alg TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tamper_backup (id INTEGER PRIMARY KEY, payload TEXT NOT NULL);
    `);
  }

  onAppend(fn: (e: LedgerEntry, ms: number) => void): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  count(): number {
    return (this.db.prepare("SELECT COUNT(*) AS n FROM entries").get() as { n: number }).n;
  }

  append(kind: string, subject: string, payload: Record<string, unknown>): LedgerEntry {
    const t = performance.now();
    const last = this.db.prepare("SELECT id, hash FROM entries ORDER BY id DESC LIMIT 1").get() as
      { id: number; hash: string } | undefined;
    const base = {
      id: (last?.id ?? 0) + 1,
      at: this.now(),
      kind,
      subject,
      payload: JSON.stringify(payload),
      prev: last?.hash ?? GENESIS,
    };
    // The key ID is part of the hash, so sign with whichever key is active right now.
    const key = this.signer.current();
    const row: Row = { ...base, key_id: key.keyId, alg: key.alg, hash: "", sig: "" };
    row.hash = entryHash(row);
    const s = this.signer.sign(hexToBytes(row.hash));
    row.sig = Buffer.from(s.signature).toString("base64");
    this.db
      .prepare(
        "INSERT INTO entries (id, at, kind, subject, payload, prev, hash, sig, key_id, alg) VALUES (@id, @at, @kind, @subject, @payload, @prev, @hash, @sig, @key_id, @alg)",
      )
      .run(row);
    const e = toEntry(row);
    const ms = performance.now() - t;
    this.listeners.forEach((fn) => fn(e, ms));
    return e;
  }

  recent(limit = 50): LedgerEntry[] {
    return (
      this.db.prepare("SELECT * FROM entries ORDER BY id DESC LIMIT ?").all(limit) as Row[]
    ).map(toEntry);
  }

  /** Entries with `from` ≤ id ≤ `to`, oldest first. */
  range(from: number, to: number): LedgerEntry[] {
    return (
      this.db
        .prepare("SELECT * FROM entries WHERE id BETWEEN ? AND ? ORDER BY id ASC")
        .all(from, to) as Row[]
    ).map(toEntry);
  }

  get(id: number): LedgerEntry | undefined {
    const r = this.db.prepare("SELECT * FROM entries WHERE id = ?").get(id) as Row | undefined;
    return r && toEntry(r);
  }

  /** Walks every entry from genesis: recomputes hashes, checks links and ML-DSA signatures. */
  verify(): VerifyResult {
    const t = performance.now();
    let prev = GENESIS;
    let expectId = 1;
    let checked = 0;
    const done = (broken?: VerifyResult["broken"]): VerifyResult => ({
      ok: !broken,
      checked,
      ms: performance.now() - t,
      head: prev,
      broken,
    });
    for (const r of this.db
      .prepare("SELECT * FROM entries ORDER BY id ASC")
      .iterate() as IterableIterator<Row>) {
      checked++;
      if (r.id !== expectId)
        return done({
          id: expectId,
          reason: "missing-entry",
          detail: `Entry #${expectId} is missing; the chain jumps to #${r.id}.`,
        });
      if (r.prev !== prev)
        return done({
          id: r.id,
          reason: "chain-broken",
          detail: `Entry #${r.id} does not link to entry #${r.id - 1}.`,
          expected: prev,
          actual: r.prev,
        });
      const recomputed = entryHash(r);
      if (recomputed !== r.hash)
        return done({
          id: r.id,
          reason: "payload-modified",
          detail: `Entry #${r.id} was modified after it was written: its SHA3-256 no longer matches.`,
          expected: r.hash,
          actual: recomputed,
        });
      const key = this.signer.publicKey(r.key_id);
      if (!key)
        return done({
          id: r.id,
          reason: "unknown-key",
          detail: `Entry #${r.id} is signed by an unknown key.`,
        });
      if (
        !getSig(key.alg).verify(
          new Uint8Array(Buffer.from(r.sig, "base64")),
          hexToBytes(r.hash),
          key.publicKey,
        )
      )
        return done({
          id: r.id,
          reason: "bad-signature",
          detail: `Entry #${r.id}: ${getSig(key.alg).name} signature does not verify.`,
        });
      prev = r.hash;
      expectId++;
    }
    return done();
  }

  /**
   * DEMO: an insider edits one row directly in SQLite (bypassing the API), keeping a backup so the
   * demo can be reset. Returns the field that changed.
   */
  tamper(id: number): { id: number; field: string; before: unknown; after: unknown } | undefined {
    const r = this.db.prepare("SELECT payload FROM entries WHERE id = ?").get(id) as
      { payload: string } | undefined;
    if (!r) return undefined;
    this.db
      .prepare("INSERT OR IGNORE INTO tamper_backup (id, payload) VALUES (?, ?)")
      .run(id, r.payload);
    const p = JSON.parse(r.payload) as Record<string, unknown>;
    const field = ["amount", "to", "subject"].find((k) => k in p) ?? Object.keys(p)[0] ?? "note";
    const before = p[field];
    const after =
      typeof before === "number"
        ? before * 100
        : typeof before === "string"
          ? `${before} (edited)`
          : "edited";
    p[field] = after;
    this.db.prepare("UPDATE entries SET payload = ? WHERE id = ?").run(JSON.stringify(p), id);
    return { id, field, before, after };
  }

  /** Puts every tampered row back exactly as it was written. */
  restore(): number[] {
    const rows = this.db.prepare("SELECT id, payload FROM tamper_backup").all() as {
      id: number;
      payload: string;
    }[];
    const upd = this.db.prepare("UPDATE entries SET payload = ? WHERE id = ?");
    for (const r of rows) upd.run(r.payload, r.id);
    this.db.prepare("DELETE FROM tamper_backup").run();
    return rows.map((r) => r.id);
  }

  tampered(): number[] {
    return (this.db.prepare("SELECT id FROM tamper_backup").all() as { id: number }[]).map(
      (r) => r.id,
    );
  }

  close() {
    this.db.close();
  }
}
