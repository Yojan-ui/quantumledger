import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getSig } from "@qsetu/core";
import { describe, expect, it } from "vitest";
import { openPglite, openSqlite } from "@/lib/db/connect";
import type { Repos } from "@/lib/db/repo";
import { DbKeyStore, KeyManager, MemoryKeyStore } from "@/lib/live/keystore";
import { Ledger, type LedgerSigner } from "@/lib/live/ledger";

function signerFor(keys: KeyManager, alg: "ml-dsa-65" | "ml-dsa-44" = "ml-dsa-65"): LedgerSigner {
  return {
    current: () => ({ keyId: keys.active("ledger", alg).meta.id, alg }),
    sign: (m) => {
      const k = keys.active("ledger", alg);
      return { signature: getSig(alg).sign(m, k.secretKey), keyId: k.meta.id, alg };
    },
    publicKey: (id) => keys.publicKey(id),
  };
}

// The same suite runs on both production dialects: SQLite (local) and Postgres (PGlite in-process).
const DIALECTS: [string, () => Promise<Repos>][] = [
  ["sqlite", () => openSqlite(":memory:")],
  ["postgres", () => openPglite()],
];

for (const [name, open] of DIALECTS) {
  describe(`Q-Ledger on ${name}`, () => {
    async function setup() {
      const repos = await open();
      const keys = new KeyManager(new MemoryKeyStore(), Buffer.alloc(32, 7));
      const ledger = new Ledger(repos.ledger, signerFor(keys));
      for (let i = 1; i <= 12; i++)
        void ledger.append("tx", `r${i}`, { amount: i * 100, sector: "fintech" });
      await ledger.flush();
      return { ledger, keys, repos };
    }

    it("chains entries with SHA3-256 and verifies ML-DSA-65 signatures", async () => {
      const { ledger } = await setup();
      const v = await ledger.verify();
      expect(v.ok).toBe(true);
      expect(v.checked).toBe(12);
      const [newest, prev] = await ledger.recent(2);
      expect(newest!.prev).toBe(prev!.hash);
      expect(newest!.alg).toBe("ml-dsa-65");
    });

    it("serialises concurrent appends into one unbroken chain", async () => {
      const { ledger } = await setup();
      await Promise.all(
        Array.from({ length: 10 }, (_, i) => ledger.append("tx", `c${i}`, { n: i })),
      );
      const v = await ledger.verify();
      expect(v).toMatchObject({ ok: true, checked: 22 });
    });

    it("pinpoints a row edited directly in the database", async () => {
      const { ledger } = await setup();
      expect(await ledger.tamper(7)).toMatchObject({
        id: 7,
        field: "amount",
        before: 700,
        after: 70000,
      });
      const v = await ledger.verify();
      expect(v.ok).toBe(false);
      expect(v.broken).toMatchObject({ id: 7, reason: "payload-modified" });
      expect(v.checked).toBe(7);
    });

    it("detects a forged hash and a deleted entry", async () => {
      const a = await setup();
      await a.repos.ledger.raw.setHash(5, "ab".repeat(32));
      expect((await a.ledger.verify()).broken?.id).toBe(5);
      const b = await setup();
      await b.repos.ledger.raw.delete(3);
      expect((await b.ledger.verify()).broken).toMatchObject({ id: 3, reason: "missing-entry" });
    });

    it("re-checks everything after a verify: edits, forged hashes and forged signatures", async () => {
      const { ledger, repos } = await setup();
      expect((await ledger.verify()).ok).toBe(true);
      // Payload edit: caught by the re-hash, even though #6's signature was already checked.
      await ledger.tamper(6);
      expect((await ledger.verify()).broken).toMatchObject({ id: 6, reason: "payload-modified" });
      await ledger.restore();
      expect((await ledger.verify()).ok).toBe(true);
      // A signature swapped for another entry's: different bytes, so it is verified again and fails.
      const [e3, e4] = await ledger.range(3, 4);
      await repos.ledger.raw.setSig(4, e3!.sig);
      expect((await ledger.verify()).broken).toMatchObject({ id: 4, reason: "bad-signature" });
      await repos.ledger.raw.setSig(4, e4!.sig);
      expect((await ledger.verify()).ok).toBe(true);
    });

    it("a fresh process checks every signature itself", async () => {
      const { ledger, keys, repos } = await setup();
      const rows = await ledger.range(2, 5);
      const e2 = rows[0]!;
      const e5 = rows[3]!;
      await repos.ledger.raw.setSig(5, e2.sig);
      // Same database, new Ledger: nothing remembered, so the forged signature on #5 is found.
      const other = new Ledger(repos.ledger, signerFor(keys));
      expect((await other.verify()).broken).toMatchObject({ id: 5, reason: "bad-signature" });
      await repos.ledger.raw.setSig(5, e5.sig);
      expect((await other.verify()).ok).toBe(true);
    });

    it("restores tampered rows, and survives key rotation", async () => {
      const { ledger, keys } = await setup();
      await ledger.tamper(4);
      expect(await ledger.restore()).toEqual([4]);
      keys.rotate("ledger");
      await ledger.append("tx", "after-rotation", { amount: 1 });
      expect((await ledger.verify()).ok).toBe(true);
      expect(new Set((await ledger.recent(20)).map((e) => e.keyId)).size).toBe(2);
    });

    it("stores scans and signups", async () => {
      const { repos } = await setup();
      await repos.scans.upsert("example.com", '{"score":1}', "2026-10-11T00:00:00Z");
      await repos.scans.upsert("example.com", '{"score":2}', "2026-10-12T00:00:00Z");
      expect(await repos.scans.get("example.com")).toMatchObject({ result: '{"score":2}' });
      await repos.signups.insert({
        kind: "early-access",
        name: "A",
        email: "a@b.in",
        organisation: "Org",
        sector: "fintech",
        useCase: "UPI",
        createdAt: "2026-10-11T00:00:00Z",
      });
      expect(await repos.signups.list()).toHaveLength(1);
    });
  });
}

describe("KMS keys in the database", () => {
  it("survive a restart, so old ledger entries stay verifiable", async () => {
    const dir = mkdtempSync(join(tmpdir(), "qsetu-"));
    const file = join(dir, "db.sqlite");
    const kek = Buffer.alloc(32, 9);
    const r1 = await openSqlite(file);
    const s1 = await DbKeyStore.open(r1.kms);
    const k1 = new KeyManager(s1, kek);
    const l1 = new Ledger(r1.ledger, signerFor(k1, "ml-dsa-44"));
    await l1.append("genesis", "x", {});
    await s1.flush();

    const r2 = await openSqlite(file);
    const k2 = new KeyManager(await DbKeyStore.open(r2.kms), kek);
    const l2 = new Ledger(r2.ledger, signerFor(k2, "ml-dsa-44"));
    expect(await l2.count()).toBe(1);
    expect((await l2.verify()).ok).toBe(true);
    expect(JSON.stringify(k2.list())).not.toMatch(/wrapped/);
  });
});
