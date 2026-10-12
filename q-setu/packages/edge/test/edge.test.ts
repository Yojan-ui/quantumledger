import { getSig } from "@qsetu/core";
import { describe, expect, it } from "vitest";
import { BudgetExceeded, EdgeDevice, EdgeGateway } from "../src";

function rig(ramBytes = 64 * 1024, batchSize = 4) {
  const deviceKey = getSig("ml-dsa-44").keygen();
  const gateway = new EdgeGateway(new Map([["meter-1", deviceKey.publicKey]]));
  const device = new EdgeDevice(
    "meter-1",
    deviceKey,
    gateway.identity.publicKey,
    { ramBytes, cpuSlowdown: 1 },
    batchSize,
  );
  return { device, gateway };
}

describe("QuantumLedger Edge", () => {
  it("handshakes once, then sends many readings within a 64 KB budget", () => {
    const { device, gateway } = rig();
    gateway.finish(device.finish(gateway.hello(device.hello())));
    for (let i = 0; i < 12; i++) {
      const { message, proof } = device.reading({ t: i, v: 230 + i / 10, u: "V" });
      expect(gateway.reading(message).v).toBeCloseTo(230 + i / 10);
      if (proof) expect(gateway.verifyBatch(proof)).toBe(true);
    }
    const s = device.stats();
    expect(s.batchesSigned).toBe(3);
    expect(s.overheadPerReading).toBe(44);
    expect(s.ramPeak).toBeLessThan(64 * 1024);
    expect(gateway.verifiedBatches).toHaveLength(3);
  });

  it("a forged batch proof is rejected", () => {
    const { device, gateway } = rig();
    gateway.finish(device.finish(gateway.hello(device.hello())));
    let proof;
    for (let i = 0; i < 4; i++) {
      const r = device.reading({ t: i, v: 1, u: "bpm" });
      gateway.reading(r.message);
      proof = r.proof;
    }
    const sig = Buffer.from(proof!.sig, "base64");
    sig[5]! ^= 1;
    expect(gateway.verifyBatch({ ...proof!, sig: sig.toString("base64") })).toBe(false);
  });

  it("enforces the RAM budget", () => {
    expect(() => rig(4 * 1024)).toThrow(BudgetExceeded);
  });
});
