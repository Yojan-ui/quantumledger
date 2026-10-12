import { getSig } from "@qsetu/core";
import { describe, expect, it } from "vitest";
import { openSqlite } from "@/lib/db/connect";
import { KeyManager, MemoryKeyStore } from "@/lib/live/keystore";
import { Ledger, type LedgerSigner } from "@/lib/live/ledger";
import { anchorProof, leafHash, merkle, sweep } from "@/lib/live/proof";

async function setup() {
  const repos = await openSqlite(":memory:");
  const keys = new KeyManager(new MemoryKeyStore(), Buffer.alloc(32, 7));
  const signer: LedgerSigner = {
    current: () => ({ keyId: keys.active("ledger", "ml-dsa-65").meta.id, alg: "ml-dsa-65" }),
    sign: (m) => {
      const k = keys.active("ledger", "ml-dsa-65");
      return {
        signature: getSig("ml-dsa-65").sign(m, k.secretKey),
        keyId: k.meta.id,
        alg: "ml-dsa-65",
      };
    },
    publicKey: (id) => keys.publicKey(id),
  };
  const ledger = new Ledger(repos.ledger, signer);
  for (let i = 0; i < 30; i++) await ledger.append("tx", `t${i}`, { amount: i });
  return ledger;
}

const input = {
  domain: "example.in",
  scan: JSON.stringify({ group: "X25519", certKey: "RSA 2048 bit" }),
  cbomSha3: "a".repeat(64),
  policy: JSON.stringify({ level: "L3" }),
  transcriptSha3: "b".repeat(64),
};

describe("Proof Chain anchors", () => {
  it("builds a domain-separated Merkle tree", () => {
    const t = merkle(["a", "b", "c", "d"]);
    expect(t.levels.map((l) => l.length)).toEqual([4, 2, 1]);
    expect(t.levels[0]![0]).toBe(leafHash("a"));
    expect(merkle(["a", "b", "c"]).levels.map((l) => l.length)).toEqual([3, 2, 1]);
    expect(merkle(["a", "b", "c", "d"]).root).not.toBe(merkle(["a", "b", "d", "c"]).root);
  });

  it("anchors after a signed checkpoint and sweeps only the segment after it", async () => {
    const ledger = await setup();
    const a = await anchorProof(ledger, input);
    expect(a.checkpoint.kind).toBe("checkpoint");
    expect(a.anchor.payload.root).toBe(a.tree.root);
    expect(a.anchor.payload.checkpoint).toBe(a.checkpoint.id);
    const r = await sweep(ledger, a.anchor.id);
    expect(r.ok).toBe(true);
    expect(r.checkpoint.ok).toBe(true);
    expect(r.segment.checked).toBe(1);
    expect(r.merkle.ok).toBe(true);
  });

  it("stops at the tampered anchor and reports the mismatch", async () => {
    const ledger = await setup();
    const a = await anchorProof(ledger, input);
    await ledger.tamper(a.anchor.id);
    const r = await sweep(ledger, a.anchor.id);
    expect(r.ok).toBe(false);
    expect(r.broken).toMatchObject({ id: a.anchor.id, reason: "payload-modified" });
    expect(r.broken!.expected).not.toBe(r.broken!.actual);
    await ledger.restore();
    expect((await sweep(ledger, a.anchor.id)).ok).toBe(true);
  });

  it("verifyEntry checks one row from scratch, verifyFrom only the tail", async () => {
    const ledger = await setup();
    expect((await ledger.verifyEntry(10)).ok).toBe(true);
    await ledger.tamper(5);
    expect((await ledger.verifyEntry(5)).broken?.reason).toBe("payload-modified");
    expect((await ledger.verifyFrom(20)).ok).toBe(true);
    expect((await ledger.verifyFrom(20)).checked).toBe(11);
    expect((await ledger.verify()).broken?.id).toBe(5);
  });
});

describe("signed checkpoints", () => {
  it("cover earlier signatures but still catch an edited row", async () => {
    const ledger = await setup();
    await ledger.checkpoint();
    for (let i = 0; i < 5; i++) await ledger.append("tx", `late${i}`, { amount: i });
    const ok = await ledger.verify();
    expect(ok.ok).toBe(true);
    expect(ok.checked).toBe(36);
    // An edit before the checkpoint is still caught (the chain is re-hashed end to end).
    await ledger.tamper(3);
    expect((await ledger.verify()).broken).toMatchObject({ id: 3, reason: "payload-modified" });
    await ledger.restore();
    // A forged signature after the checkpoint is caught by the tail check.
    await ledger.repo.raw.setSig(34, Buffer.from(new Uint8Array(3309)).toString("base64"));
    expect((await ledger.verify()).broken).toMatchObject({ id: 34, reason: "bad-signature" });
  });
});
