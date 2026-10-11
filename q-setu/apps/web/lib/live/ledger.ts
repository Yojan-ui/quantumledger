/**
 * Q-Ledger: an append-only, tamper-evident audit log (SQLite locally, Postgres in production).
 *
 *   hash_n = SHA3-256("qledger-v1" ‖ id ‖ at ‖ kind ‖ subject ‖ payload ‖ hash_{n-1} ‖ key_id)
 *   sig_n  = ML-DSA-65(hash_n)            (the signing key comes from the KMS and rotates)
 *
 * Editing any row changes its hash, which no longer matches the stored hash or the next row's
 * `prev`; re-computing the hash doesn't help without the ledger's signing key. `verify()` walks the
 * whole chain and names the first entry that fails, and why. Appends are serialised, so concurrent
 * writers in one process can never fork the chain.
 */
import { sha3_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, encodeParts, getSig, hexToBytes, utf8ToBytes, type SigId } from "@qsetu/core";
import type { LedgerRow, Repos } from "@/lib/db/repo";

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
const PAGE = 1000;

export function entryHash(
  r: Pick<LedgerRow, "id" | "at" | "kind" | "subject" | "payload" | "prev" | "keyId">,
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
        utf8ToBytes(r.keyId),
      ),
    ),
  );
}

const toEntry = (r: LedgerRow): LedgerEntry => ({
  ...r,
  payload: JSON.parse(r.payload) as Record<string, unknown>,
});

export class Ledger {
  private readonly listeners = new Set<(e: LedgerEntry, ms: number) => void>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    readonly repo: Repos["ledger"],
    private readonly signer: LedgerSigner,
    private readonly now: () => number = Date.now,
  ) {}

  onAppend(fn: (e: LedgerEntry, ms: number) => void): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  count(): Promise<number> {
    return this.repo.count();
  }

  /** Appends one entry. Calls are queued, so the chain is extended strictly in order. */
  append(kind: string, subject: string, payload: Record<string, unknown>): Promise<LedgerEntry> {
    const run = this.queue.then(() => this.appendNow(kind, subject, payload));
    this.queue = run.catch(() => {});
    return run;
  }

  private async appendNow(kind: string, subject: string, payload: Record<string, unknown>) {
    const t = performance.now();
    const last = await this.repo.last();
    const key = this.signer.current();
    const row: LedgerRow = {
      id: (last?.id ?? 0) + 1,
      at: this.now(),
      kind,
      subject,
      payload: JSON.stringify(payload),
      prev: last?.hash ?? GENESIS,
      keyId: key.keyId,
      alg: key.alg,
      hash: "",
      sig: "",
    };
    row.hash = entryHash(row);
    row.sig = Buffer.from(this.signer.sign(hexToBytes(row.hash)).signature).toString("base64");
    await this.repo.insert(row);
    const e = toEntry(row);
    const ms = performance.now() - t;
    this.listeners.forEach((fn) => fn(e, ms));
    return e;
  }

  /** Waits for queued appends (tests, shutdown). */
  async flush(): Promise<void> {
    await this.queue;
  }

  async recent(limit = 50): Promise<LedgerEntry[]> {
    return (await this.repo.recent(limit)).map(toEntry);
  }

  /** Entries with `from` ≤ id ≤ `to`, oldest first. */
  async range(from: number, to: number): Promise<LedgerEntry[]> {
    return (await this.repo.range(from, to)).map(toEntry);
  }

  async get(id: number): Promise<LedgerEntry | undefined> {
    const r = await this.repo.get(id);
    return r && toEntry(r);
  }

  /** Walks every entry from genesis: recomputes hashes, checks links and ML-DSA signatures. */
  async verify(): Promise<VerifyResult> {
    await this.flush();
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
    for (let after = 0; ;) {
      const page = await this.repo.page(after, PAGE);
      if (!page.length) break;
      for (const r of page) {
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
        const key = this.signer.publicKey(r.keyId);
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
      after = page.at(-1)!.id;
    }
    return done();
  }

  /**
   * DEMO: an insider edits one row directly in the database (bypassing the API), keeping a backup so
   * the demo can be reset. Returns the field that changed.
   */
  async tamper(
    id: number,
  ): Promise<{ id: number; field: string; before: unknown; after: unknown } | undefined> {
    await this.flush();
    const r = await this.repo.get(id);
    if (!r) return undefined;
    await this.repo.backup(id, r.payload);
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
    await this.repo.setPayload(id, JSON.stringify(p));
    return { id, field, before, after };
  }

  /** Puts every tampered row back exactly as it was written. */
  async restore(): Promise<number[]> {
    const rows = await this.repo.backups();
    for (const r of rows) await this.repo.setPayload(r.id, r.payload);
    await this.repo.clearBackups();
    return rows.map((r) => r.id);
  }

  async tampered(): Promise<number[]> {
    return (await this.repo.backups()).map((r) => r.id);
  }
}
