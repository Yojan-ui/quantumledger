import { describe, expect, it } from "vitest";
import { type DnsLike, instructions, verifyOwnership, verifyRouting } from "../src/onboard";

const fake = (zone: {
  txt?: Record<string, string[][]>;
  cname?: Record<string, string[]>;
  a?: Record<string, string[]>;
}): DnsLike => ({
  resolveTxt: async (n) => {
    const v = zone.txt?.[n];
    if (!v) throw Object.assign(new Error("nx"), { code: "ENOTFOUND" });
    return v;
  },
  resolveCname: async (n) => zone.cname?.[n] ?? [],
  resolve4: async (n) => zone.a?.[n] ?? [],
});

describe("DNS onboarding", () => {
  const token = "tok_abc123";
  it("gives the two records to add", () => {
    const i = instructions("www.shop.in", token);
    expect(i.txt).toEqual({
      type: "TXT",
      name: "_qsetu-challenge.www.shop.in",
      value: "qsetu-verify=tok_abc123",
    });
    expect(i.cname.value).toBe("edge.quantumledger.app");
  });
  it("verifies ownership from the TXT record (also split into chunks)", async () => {
    const r = fake({
      txt: { "_qsetu-challenge.www.shop.in": [["v=spf1"], ["qsetu-ver", "ify=tok_abc123"]] },
    });
    expect(await verifyOwnership("www.shop.in", token, r)).toEqual({ ok: true });
  });
  it("refuses a wrong token, a missing record and a bad name", async () => {
    expect(
      await verifyOwnership(
        "www.shop.in",
        token,
        fake({ txt: { "_qsetu-challenge.www.shop.in": [["qsetu-verify=other"]] } }),
      ),
    ).toEqual({ ok: false, reason: "mismatch" });
    expect(await verifyOwnership("www.shop.in", token, fake({}))).toEqual({
      ok: false,
      reason: "no_record",
    });
    expect(await verifyOwnership("not a domain", token, fake({}))).toEqual({
      ok: false,
      reason: "invalid_domain",
    });
  });
  it("sees when traffic is routed to the edge, by CNAME or matching A records", async () => {
    expect(
      await verifyRouting(
        "www.shop.in",
        undefined,
        fake({ cname: { "www.shop.in": ["edge.quantumledger.app."] } }),
      ),
    ).toEqual({ ok: true, via: "cname" });
    expect(
      await verifyRouting(
        "shop.in",
        undefined,
        fake({
          a: {
            "shop.in": ["203.0.113.9"],
            "edge.quantumledger.app": ["203.0.113.9", "203.0.113.10"],
          },
        }),
      ),
    ).toEqual({ ok: true, via: "a" });
    expect(
      await verifyRouting(
        "www.shop.in",
        undefined,
        fake({ a: { "www.shop.in": ["198.51.100.1"] } }),
      ),
    ).toEqual({ ok: false, reason: "not_pointed" });
  });
});
