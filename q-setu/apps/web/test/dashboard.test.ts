/**
 * The Shield dashboard's storage and auth pieces, on both production dialects (SQLite and Postgres
 * via PGlite): accounts, tenant isolation of sites, event and stats intake, password hashing and
 * signed sessions.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { openPglite, openSqlite } from "@/lib/db/connect";
import type { Repos, SiteRow } from "@/lib/db/repo";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
const { checkPassword, hashPassword, readSession, sessionValue } =
  await import("@/lib/server/dashboard");

const site = (id: string, accountId: string, domain: string, keyHash: string): SiteRow => ({
  id,
  accountId,
  domain,
  verifyToken: "t",
  keyHash,
  mode: "monitor",
  settings: "{}",
  verifiedAt: null,
  createdAt: new Date().toISOString(),
});

for (const [name, open] of [
  ["sqlite", () => openSqlite(join(mkdtempSync(join(tmpdir(), "dash-")), "db.sqlite"))],
  ["postgres", () => openPglite()],
] as [string, () => Promise<Repos>][]) {
  describe(`dashboard storage on ${name}`, () => {
    it("keeps one account's sites invisible to another", async () => {
      const r = await open();
      await r.accounts.create({
        id: "A",
        email: "a@x.in",
        pwHash: "h",
        totpSealed: "",
        totpOn: 0,
        createdAt: "now",
      });
      await r.accounts.create({
        id: "B",
        email: "b@x.in",
        pwHash: "h",
        totpSealed: "",
        totpOn: 0,
        createdAt: "now",
      });
      await r.sites.create(site("s1", "A", "shop.example", "k1"));
      expect(await r.sites.owned("A", "s1")).toBeDefined();
      expect(await r.sites.owned("B", "s1")).toBeUndefined();
      expect(await r.sites.forAccount("B")).toEqual([]);
      // An update through the wrong account changes nothing.
      await r.sites.update("B", "s1", { mode: "off" });
      expect((await r.sites.owned("A", "s1"))?.mode).toBe("monitor");
      await r.sites.update("A", "s1", { mode: "protect", verifiedAt: "2026-10-14" });
      expect((await r.sites.verifiedFor("shop.example"))?.id).toBe("s1");
      expect((await r.sites.byKeyHash("k1"))?.id).toBe("s1");
    });

    it("adds daily stats up and keeps events per site", async () => {
      const r = await open();
      await r.shieldStats.add("s1", "2026-10-14", {
        pq: 3,
        classical: 1,
        requests: 10,
        challenged: 1,
        blocked: 0,
      });
      await r.shieldStats.add("s1", "2026-10-14", {
        pq: 2,
        classical: 0,
        requests: 5,
        challenged: 0,
        blocked: 2,
      });
      await r.shieldStats.add("s2", "2026-10-14", {
        pq: 9,
        classical: 9,
        requests: 9,
        challenged: 9,
        blocked: 9,
      });
      const [d] = await r.shieldStats.range("s1", "2026-10-01", "2026-10-31");
      expect([d?.pq, d?.classical, d?.requests, d?.challenged, d?.blocked].map(Number)).toEqual([
        5, 1, 15, 1, 2,
      ]);
      await r.shieldEvents.insert([
        { siteId: "s1", at: 1_760_000_000_000, type: "honeypot", score: 100, detail: "{}" },
      ]);
      await r.shieldEvents.insert([
        { siteId: "s2", at: 1_760_000_000_001, type: "block", score: 90, detail: "{}" },
      ]);
      const ev = await r.shieldEvents.recent("s1", 10);
      expect(ev.map((e) => e.type)).toEqual(["honeypot"]);
      expect(typeof ev[0]!.at).toBe("number");
    });
  });
}

describe("dashboard auth", () => {
  it("hashes passwords with scrypt and checks them", () => {
    const h = hashPassword("correct horse battery");
    expect(h).toMatch(/^scrypt\$15\$8\$1\$/);
    expect(checkPassword("correct horse battery", h)).toBe(true);
    expect(checkPassword("correct horse batterY", h)).toBe(false);
    expect(checkPassword("anything", undefined)).toBe(false);
  });

  it("signs sessions, refuses tampering, and expires partial ones sooner", () => {
    const now = 1_800_000_000_000;
    const v = sessionValue("acct", "full", now);
    expect(readSession(v, now + 1000)).toEqual({ accountId: "acct", stage: "full" });
    expect(readSession(v.replace("full", "otp"), now)).toBeUndefined();
    expect(readSession(v.replace("acct", "evil"), now)).toBeUndefined();
    expect(readSession(v, now + 13 * 3_600_000)).toBeUndefined();
    const partial = sessionValue("acct", "otp", now);
    expect(readSession(partial, now + 5 * 60_000)?.stage).toBe("otp");
    expect(readSession(partial, now + 11 * 60_000)).toBeUndefined();
  });
});
