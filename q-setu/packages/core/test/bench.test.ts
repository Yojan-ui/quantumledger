import { describe, expect, it } from "vitest";
import { median, runBench } from "../src";

describe("bench", () => {
  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("reports every registered algorithm plus baselines, with sizes", async () => {
    const r = await runBench(2);
    const ids = r.rows.map((x) => x.id);
    for (const id of [
      "x25519",
      "ml-kem-768",
      "hybrid-x25519-mlkem768",
      "rsa-2048-oaep",
      "ml-dsa-65",
      "ed25519",
      "ecdsa-p256",
      "ml-dsa-44",
      "ml-kem-512",
      "slh-dsa-sha2-128f",
      "classical-envelope",
    ]) {
      expect(ids).toContain(id);
    }
    const mlkem = r.rows.find((x) => x.id === "ml-kem-768")!;
    expect(mlkem.sizes).toMatchObject({ publicKey: 1184, output: 1088 });
    expect(mlkem.ops.encapsulate).toBeGreaterThan(0);
    expect(r.sessions.map((x) => x.profile)).toEqual(["standard", "maximum", "edge"]);
    for (const sess of r.sessions) {
      expect(sess.handshakeMs).toBeGreaterThan(0);
      expect(sess.messageOverheadBytes).toBe(44);
      // The whole point: one message costs far less than one handshake.
      expect(sess.perMessageUs / 1000).toBeLessThan(sess.handshakeMs);
    }
  });
});
