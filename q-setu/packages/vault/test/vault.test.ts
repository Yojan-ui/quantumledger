import { describe, expect, it } from "vitest";
import { createVault, generateVaultKeys, memoryStore, VaultError } from "../src";

const report = {
  patient: "Asha Rao",
  abha: "91-1234-5678-9012",
  test: "HbA1c",
  result: "6.1 %",
  lab: "Pune General",
};

describe("Q-Setu Vault", () => {
  it("put → get round-trip; the store only holds ciphertext", async () => {
    const store = memoryStore();
    const vault = createVault({ keys: generateVaultKeys(), store });
    const { id } = await vault.put(report, { meta: { type: "lab-report" } });
    expect(JSON.stringify(store.raw.get(id))).not.toContain("Asha");
    expect((await vault.get(id)).data).toEqual(report);
  });

  it("detects tampering with the ciphertext, the metadata or the wrapped key", async () => {
    for (const field of ["ct", "wrappedKey", "meta"] as const) {
      const store = memoryStore();
      const vault = createVault({ keys: generateVaultKeys(), store });
      const { id } = await vault.put(report, { meta: { type: "lab-report" } });
      const r = store.raw.get(id)!;
      if (field === "meta") r.meta = { type: "prescription" };
      else {
        const b = Buffer.from(r[field], "base64");
        b[0]! ^= 1;
        r[field] = b.toString("base64");
      }
      await expect(vault.get(id)).rejects.toMatchObject({ reason: "tamper" });
    }
  });

  it("rotate() re-wraps keys without re-encrypting records, even across profiles", async () => {
    const store = memoryStore();
    const vault = createVault({ keys: generateVaultKeys("standard"), store });
    const { id } = await vault.put(report);
    const ctBefore = store.raw.get(id)!.ct;
    expect(await vault.rotate(generateVaultKeys("edge"))).toBe(1);
    expect(store.raw.get(id)!.ct).toBe(ctBefore);
    expect(store.raw.get(id)!.profile).toBe("edge");
    expect((await vault.get(id)).data).toEqual(report);
  });

  it("unknown id → not-found", async () => {
    await expect(createVault({ keys: generateVaultKeys() }).get("nope")).rejects.toBeInstanceOf(
      VaultError,
    );
  });
});
