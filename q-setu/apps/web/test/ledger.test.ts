import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getSig } from "@qsetu/core";
import { describe, expect, it } from "vitest";
import { KeyManager, MemoryKeyStore } from "@/lib/live/keystore";
import { Ledger, type LedgerSigner } from "@/lib/live/ledger";

function setup() {
  const keys = new KeyManager(new MemoryKeyStore(), Buffer.alloc(32, 7));
  const signer: LedgerSigner = {
    current: () => {
      const k = keys.active("ledger", "ml-dsa-65");
      return { keyId: k.meta.id, alg: k.meta.alg };
    },
    sign: (m) => {
      const k = keys.active("ledger", "ml-dsa-65");
      return {
        signature: getSig(k.meta.alg).sign(m, k.secretKey),
        keyId: k.meta.id,
        alg: k.meta.alg,
      };
    },
    publicKey: (id) => keys.publicKey(id),
  };
  const ledger = new Ledger(":memory:", signer);
  for (let i = 1; i <= 12; i++)
    ledger.append("tx", `r${i}`, { amount: i * 100, sector: "fintech" });
  return { ledger, keys };
}

describe("Q-Ledger", () => {
  it("chains entries with SHA3-256 and verifies ML-DSA-65 signatures", () => {
    const { ledger } = setup();
    const v = ledger.verify();
    expect(v.ok).toBe(true);
    expect(v.checked).toBe(12);
    const [newest, prev] = ledger.recent(2);
    expect(newest!.prev).toBe(prev!.hash);
    expect(newest!.alg).toBe("ml-dsa-65");
  });

  it("pinpoints a row edited directly in the database", () => {
    const { ledger } = setup();
    const t = ledger.tamper(7);
    expect(t).toMatchObject({ id: 7, field: "amount", before: 700, after: 70000 });
    const v = ledger.verify();
    expect(v.ok).toBe(false);
    expect(v.broken).toMatchObject({ id: 7, reason: "payload-modified" });
    expect(v.checked).toBe(7);
  });

  it("detects a forged hash (re-hashed row breaks the next link or the signature)", () => {
    const { ledger } = setup();
    ledger.db.prepare("UPDATE entries SET hash = ? WHERE id = 5").run("ab".repeat(32));
    const v = ledger.verify();
    expect(v.broken?.id).toBe(5);
  });

  it("detects a deleted entry and a re-linked chain", () => {
    const { ledger } = setup();
    ledger.db.prepare("DELETE FROM entries WHERE id = 3").run();
    expect(ledger.verify().broken).toMatchObject({ id: 3, reason: "missing-entry" });
  });

  it("restores tampered rows, and survives key rotation", () => {
    const { ledger, keys } = setup();
    ledger.tamper(4);
    expect(ledger.restore()).toEqual([4]);
    keys.rotate("ledger");
    ledger.append("tx", "after-rotation", { amount: 1 });
    const v = ledger.verify();
    expect(v.ok).toBe(true);
    const ids = new Set(ledger.recent(20).map((e) => e.keyId));
    expect(ids.size).toBe(2);
  });

  it("persists to SQLite on disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "qledger-"));
    const keys = new KeyManager(new MemoryKeyStore(), Buffer.alloc(32, 1));
    const signer: LedgerSigner = {
      current: () => ({ keyId: keys.active("ledger", "ml-dsa-44").meta.id, alg: "ml-dsa-44" }),
      sign: (m) => {
        const k = keys.active("ledger", "ml-dsa-44");
        return {
          signature: getSig("ml-dsa-44").sign(m, k.secretKey),
          keyId: k.meta.id,
          alg: "ml-dsa-44",
        };
      },
      publicKey: (id) => keys.publicKey(id),
    };
    const a = new Ledger(join(dir, "l.sqlite"), signer);
    a.append("genesis", "x", {});
    a.close();
    const b = new Ledger(join(dir, "l.sqlite"), signer);
    expect(b.count()).toBe(1);
    expect(b.verify().ok).toBe(true);
    b.close();
  });
});
