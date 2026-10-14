/**
 * The shared API limits: visitors who share one IP (a carrier-grade NAT) each get their own read
 * budget through their demo session, but the per-IP ceiling still stops a script that mints new
 * sessions. Uses the in-process counters (no Upstash configured).
 */
import { describe, expect, it } from "vitest";
import { limitsFor } from "@/lib/server/api-policy";
import { take, type Limit } from "@/lib/server/limits";

const req = (ip: string) => new Request("http://x/api/metrics", { headers: { "x-forwarded-for": ip } });

describe("API limits", () => {
  it("gives each session on one IP its own budget, under an IP ceiling", async () => {
    const perClient: Limit = { name: "t-client", limit: 3, windowMs: 60_000 };
    const perIp: Limit = { name: "t-ip", limit: 5, windowMs: 60_000, per: "ip" };
    const r = req("100.64.0.9");
    for (let i = 0; i < 3; i++) expect((await take(r, [perClient, perIp], "a")).ok).toBe(true);
    // Session a is spent; session b on the same IP still has its own budget...
    const a = await take(r, [perClient, perIp], "a");
    expect(a.ok).toBe(false);
    expect((await take(r, [perClient, perIp], "b")).ok).toBe(true);
    // ...until the IP as a whole reaches its ceiling, whatever the session.
    expect((await take(r, [perClient, perIp], "c")).ok).toBe(true);
    const d = await take(r, [perClient, perIp], "d");
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.limit.name).toBe("t-ip");
  });

  it("falls back to the IP when there is no session", async () => {
    const l: Limit = { name: "t-anon", limit: 2, windowMs: 60_000 };
    const r = req("100.64.0.10");
    expect((await take(r, [l])).ok).toBe(true);
    expect((await take(r, [l])).ok).toBe(true);
    expect((await take(r, [l])).ok).toBe(false);
  });

  it("puts an IP ceiling on every route class", () => {
    for (const [path, method] of [
      ["/api/metrics", "GET"],
      ["/api/early-access", "POST"],
      ["/api/scan", "POST"],
      ["/api/stream", "GET"],
    ] as const)
      expect(limitsFor(path, method).some((l) => l.per === "ip")).toBe(true);
  });
});
