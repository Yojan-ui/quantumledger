import { describe, expect, it } from "vitest";
import { Bus } from "@/lib/live/bus";
import { KeyManager, MemoryKeyStore } from "@/lib/live/keystore";
import { Mesh, ROTATE_EVERY } from "@/lib/live/mesh";
import { Policy } from "@/lib/live/policy";
import type { OpEvent } from "@/lib/live/types";

function setup() {
  const bus = new Bus();
  const policy = new Policy();
  const keys = new KeyManager(new MemoryKeyStore(), Buffer.alloc(32, 3));
  const mesh = new Mesh(bus, policy, keys, undefined, { tamperOneIn: 1e9 });
  const events: OpEvent[] = [];
  bus.subscribe((e) => events.push(e));
  return { bus, policy, keys, mesh, events };
}

describe("policy hot-swap", () => {
  it("changes generation only on a real change", () => {
    const p = new Policy();
    expect(p.set({ profile: "standard" }).generation).toBe(1);
    const next = p.set({ profile: "edge" });
    expect(next).toMatchObject({ profile: "edge", sig: "ml-dsa-44", generation: 2 });
    expect(p.set({ sig: "slh-dsa-sha2-128f" })).toMatchObject({
      profile: "edge",
      sig: "slh-dsa-sha2-128f",
      generation: 3,
    });
  });

  it("live sessions keep running and re-key onto the new policy at their next rotation", () => {
    const { mesh, policy, events } = setup();
    for (let i = 0; i < 3; i++) mesh.step({ route: 0 });
    expect(events.filter((e) => e.op === "SEAL").every((e) => e.alg === "ml-kem-768+x25519")).toBe(
      true,
    );

    policy.set({ profile: "edge" });
    expect(mesh.status().linksOnCurrent).toBe(0);
    // Before the rotation boundary, the link still uses the old keys...
    mesh.step({ route: 0 });
    expect(events.at(-3)?.alg).toBe("ml-kem-768+x25519");
    // ...and at the boundary it re-handshakes with the edge profile.
    for (let i = 4; i < ROTATE_EVERY; i++) mesh.step({ route: 0 });
    const rekey = events.find((e) => e.op === "ROTATE" && e.source === "policy");
    expect(rekey?.alg).toBe("ml-kem-512+x25519 · ml-dsa-44");
    expect(mesh.status().linksOnCurrent).toBe(1);
    events.length = 0;
    mesh.step({ route: 0 });
    expect(events.find((e) => e.op === "SEAL")?.alg).toBe("ml-kem-512+x25519");
    expect(events.find((e) => e.op === "SIGN")?.alg).toBe("ml-dsa-44");
    expect(events.find((e) => e.op === "VERIFY")?.ok).toBe(true);
  });

  it("a tampered packet is rejected by AES-GCM and the session survives", () => {
    const { mesh, events } = setup();
    mesh.step({ route: 2, tamper: true });
    expect(events.find((e) => e.op === "REJECT")?.detail).toMatch(/tampered/);
    mesh.step({ route: 2 });
    expect(events.filter((e) => e.op === "VERIFY" && e.ok)).toHaveLength(1);
  });

  it("publishes rolling metrics with percentiles", () => {
    const { mesh, bus, policy } = setup();
    for (let i = 0; i < 4; i++) mesh.step();
    const m = bus.metrics(policy.get());
    expect(m.byOp.SEAL?.count).toBe(4);
    expect(m.byOp.SIGN!.p95).toBeGreaterThanOrEqual(m.byOp.SIGN!.p50);
    expect(m.opsPerSec).toBeGreaterThan(0);
  });

  it("KMS never exposes secret keys in its listing", () => {
    const { keys } = setup();
    keys.active("ledger", "ml-dsa-65");
    const listed = JSON.stringify(keys.list());
    expect(listed).not.toMatch(/wrapped|secret/i);
  });
});
