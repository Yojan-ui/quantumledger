import { describe, expect, it } from "vitest";
import { ScanLimits, scanClientKey } from "@/lib/live/rate-limit";

const req = (h: Record<string, string>) => new Request("http://x/api/scan/url", { headers: h });

describe("anonymous scan limits", () => {
  it("ignores a client-sent X-Forwarded-For unless a trusted proxy is configured", () => {
    expect(scanClientKey(req({ "x-forwarded-for": "9.9.9.9" }), false)).toBe("anonymous");
    expect(scanClientKey(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }), true)).toBe(
      "203.0.113.7",
    );
  });
  it("6 per minute and 30 per hour per client; refused tries are not counted", () => {
    let t = 0;
    const l = new ScanLimits(() => t);
    for (let i = 0; i < 6; i++) expect(l.take("a")).toBe(0);
    expect(l.take("a")).toBeGreaterThan(0);
    expect(l.take("b")).toBe(0); // another client is unaffected
    for (let m = 1; m <= 4; m++) {
      t = m * 61_000;
      for (let i = 0; i < 6; i++) l.take("a");
    }
    t = 5 * 61_000;
    expect(l.take("a")).toBeGreaterThan(60); // 30 used this hour: wait for the hour window
  });
  it("a server-wide ceiling bounds spoofed keys and unknown callers: 30 per minute in total", () => {
    const l = new ScanLimits(() => 0);
    for (let i = 0; i < 30; i++) expect(l.take(`ip${i}`)).toBe(0);
    expect(l.take("fresh")).toBeGreaterThan(0);
    const anon = new ScanLimits(() => 0);
    for (let i = 0; i < 30; i++) expect(anon.take("anonymous")).toBe(0); // no per-IP cap without an IP
    expect(anon.take("anonymous")).toBeGreaterThan(0);
  });
});
