import { describe, expect, it } from "vitest";
import { breakClassical, SECTOR_IDS, SectorNetwork, type NetEvent } from "../src";

describe.each(SECTOR_IDS)("%s network", (sector) => {
  it("delivers every record in both modes with valid signatures", async () => {
    const net = new SectorNetwork(sector);
    const events: NetEvent[] = [];
    net.subscribe((e) => events.push(e));
    const { records, done } = net.simulate(3, 0);
    await done;
    for (const mode of ["classical", "qsetu"] as const) {
      const delivered = events.filter((e) => e.mode === mode && e.stage === "delivered");
      expect(delivered.map((e) => e.recordId).sort()).toEqual(
        records.map((r) => r.recordId).sort(),
      );
      expect(delivered.every((e) => e.packet?.signatureStatus === "valid")).toBe(true);
    }
    expect(net.harvested()).toHaveLength(3 * 2 * 2);
  });

  it("Q-Day: classical decrypts to the originals; QuantumLedger stays sealed even with X25519 broken", async () => {
    const net = new SectorNetwork(sector);
    const { records, done } = net.simulate(3, 0);
    await done;
    const classical = breakClassical(net.harvested());
    expect(classical).toHaveLength(6);
    for (const o of classical) {
      expect(o.status).toBe("decrypted");
      expect(records).toContainEqual(o.plaintext);
    }
    const q = net.qDayQsetu();
    expect(q).toHaveLength(6);
    for (const o of q) {
      expect(o.status).toBe("sealed");
      expect(o.log.join(" ")).toMatch(/simulated Shor oracle/);
    }
  });
});
