/**
 * The defence engine against the behaviours it's meant to catch, and the people it must not.
 * Time is simulated, DNS is stubbed.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Guard, type GuardConfig, type GuardEvent, type RequestInfo } from "../src/engine";
import { issueChallenge, leadingZeroBits, POW_PATH, validPass, verifySolution } from "../src/pow";

const SECRET = "s".repeat(40);
const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const browser = (ip: string, path = "/", extra: Record<string, string> = {}): RequestInfo => ({
  ip,
  method: "GET",
  path,
  headers: {
    "user-agent": CHROME,
    accept: "text/html,application/xhtml+xml",
    "accept-language": "en-IN,en;q=0.9",
    "sec-fetch-mode": "navigate",
    ...extra,
  },
});

function guard(over: Partial<GuardConfig> = {}) {
  let t = 1_000_000;
  const events: GuardEvent[] = [];
  const g = new Guard({
    mode: "protect",
    secret: SECRET,
    trapPath: "/qsetu-trap-7f3a",
    canaryKeys: ["qsk_canary_9b1c"],
    now: () => t,
    onEvent: (e) => events.push(e),
    reverse: async () => [],
    lookup: async () => [],
    ...over,
  });
  return { g, events, tick: (ms: number) => (t += ms), now: () => t };
}

/** Runs a request through check() and finish() with the given origin status. */
async function hit(g: Guard, r: RequestInfo, status = 200) {
  const d = await g.check(r);
  g.finish(r, d.response?.status ?? status);
  return d;
}

describe("Guard", () => {
  it("lets an ordinary visitor browse", async () => {
    const { g, tick } = guard();
    for (const p of ["/", "/pricing", "/about", "/docs", "/docs/api", "/contact"]) {
      const d = await hit(g, browser("203.0.113.5", p));
      expect(d.action).toBe("allow");
      expect(d.score).toBeLessThan(30);
      tick(4000);
    }
  });

  it("blocks honeypot, trap-link and canary-key use at once, plainly and slowly", async () => {
    for (const r of [
      browser("198.51.100.1", "/.env"),
      browser("198.51.100.2", "/wp-login.php"),
      browser("198.51.100.3", "/.git/config"),
      browser("198.51.100.4", "/qsetu-trap-7f3a"),
      browser("198.51.100.5", "/api/data", { authorization: "Bearer qsk_canary_9b1c" }),
    ]) {
      const { g, events } = guard();
      const d = await hit(g, r);
      expect(d.action).toBe("block");
      expect(d.response?.status).toBe(404);
      expect(d.response?.body).toBe("Not found\n");
      expect(d.response?.delayMs).toBeGreaterThan(0);
      expect(events.map((e) => e.type)).toContain(
        r.path.includes("trap") ? "trap" : r.headers.authorization ? "canary" : "honeypot",
      );
      // ...and stays blocked for its next, innocent-looking request.
      expect((await hit(g, browser(r.ip, "/"))).action).toBe("block");
    }
  });

  it("escalates a route-scanning agent from allow to limit/challenge to block", async () => {
    const { g, tick } = guard();
    const actions: string[] = [];
    for (let i = 0; i < 400; i++) {
      const d = await hit(
        g,
        {
          ip: "192.0.2.77",
          method: "GET",
          path: `/page-${i}`,
          headers: { "user-agent": "python-requests/2.32", accept: "*/*" },
        },
        404,
      );
      actions.push(d.action);
      tick(50);
    }
    expect(actions[0]).toBe("allow");
    expect(actions).toContain("block");
    expect(actions.indexOf("block")).toBeGreaterThan(
      actions.findIndex((a) => a === "limit" || a === "challenge"),
    );
  });

  it("treats a burst of 1,000 parallel requests as an attack", async () => {
    const { g } = guard();
    const r = {
      ip: "192.0.2.88",
      method: "GET",
      path: "/api/items",
      headers: { "user-agent": "Go-http-client/1.1" },
    };
    // All checked before any finishes: 1,000 in flight at once.
    const ds = await Promise.all(Array.from({ length: 1000 }, () => g.check(r)));
    const blocked = ds.filter((d) => d.action !== "allow").length;
    expect(blocked).toBeGreaterThan(900);
  });

  it("challenges a suspicious browser navigation with a proof of work, and lets it in once solved", async () => {
    const { g } = guard({ mode: "strict" });
    // A browser UA from a non-browser TLS stack, without accept-language: suspicious, not certain.
    const r: RequestInfo = {
      ...browser("192.0.2.99", "/"),
      headers: { "user-agent": CHROME, accept: "text/html" },
      tls: { version: 0x0303, alpn: ["http/1.1"] },
    };
    const d = await hit(g, r);
    expect(d.action).toBe("challenge");
    expect(d.response?.body).toContain("crypto.subtle.digest");
    expect(d.response?.headers["content-security-policy"]).toMatch(/script-src 'nonce-/);
    // Solve it the way the page would.
    const c = d.response!.body.match(/const c = "([^"]+)"/)![1]!;
    const bits = JSON.parse(Buffer.from(c.split(".")[0]!, "base64url").toString()).b as number;
    let n = 0;
    while (leadingZeroBits(createHash("sha256").update(`${c}.${n}`).digest()) < bits) n++;
    const res = g.solve(
      { ...r, method: "POST", path: POW_PATH },
      JSON.stringify({ c, n: String(n) }),
    );
    expect(res.status).toBe(204);
    const pass = res.headers["set-cookie"]!.split(";")[0]!;
    const again = await hit(g, { ...r, headers: { ...r.headers, cookie: pass } });
    expect(again.action).toBe("allow");
  });

  it("rejects a solved challenge replayed from another IP, a wrong answer and a forged pass", () => {
    const c = issueChallenge(SECRET, "10.0.0.1", 8, 0);
    let n = 0;
    while (leadingZeroBits(createHash("sha256").update(`${c}.${n}`).digest()) < 8) n++;
    expect(verifySolution(SECRET, "10.0.0.2", c, String(n), 1)).toBeUndefined();
    let wrong = 0;
    while (leadingZeroBits(createHash("sha256").update(`${c}.${wrong}`).digest()) >= 8) wrong++;
    expect(verifySolution(SECRET, "10.0.0.1", c, String(wrong), 1)).toBeUndefined();
    const pass = verifySolution(SECRET, "10.0.0.1", c, String(n), 1)!;
    expect(validPass(SECRET, "10.0.0.1", pass, 2)).toBe(true);
    expect(validPass(SECRET, "10.0.0.2", pass, 2)).toBe(false);
    expect(validPass("x".repeat(40), "10.0.0.1", pass, 2)).toBe(false);
    expect(validPass(SECRET, "10.0.0.1", pass, 2 + 61 * 60_000)).toBe(false);
  });

  it("allows a search engine that DNS confirms, and catches one that doesn't", async () => {
    const ua = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    const real = guard({
      reverse: async () => ["crawl-66-249-66-1.googlebot.com"],
      lookup: async () => ["66.249.66.1"],
    });
    const ok = await hit(real.g, {
      ip: "66.249.66.1",
      method: "GET",
      path: "/",
      headers: { "user-agent": ua },
    });
    expect(ok.action).toBe("allow");
    expect(real.events.map((e) => e.type)).toContain("bot_verified");

    const fake = guard({
      reverse: async () => ["host.attacker.example"],
      lookup: async () => ["192.0.2.5"],
    });
    await hit(fake.g, { ip: "192.0.2.5", method: "GET", path: "/", headers: { "user-agent": ua } });
    expect(fake.events.map((e) => e.type)).toContain("bot_impersonation");
  });

  it("monitor mode reports what it would do and never blocks", async () => {
    const { g, events } = guard({ mode: "monitor" });
    const d = await hit(g, browser("198.51.100.9", "/.env"));
    expect(d.action).toBe("allow");
    expect(d.wouldAct).toBe(true);
    expect(d.response).toBeUndefined();
    expect(events[0]?.monitorOnly).toBe(true);
  });

  it("off mode does nothing; the emergency switch takes effect immediately", async () => {
    const { g } = guard();
    g.setMode("off");
    expect((await hit(g, browser("198.51.100.10", "/.env"))).action).toBe("allow");
    g.setMode("protect");
    expect((await hit(g, browser("198.51.100.10", "/.env"))).action).toBe("block");
  });

  it("does not punish many people behind one carrier-grade NAT address block", async () => {
    const { g, tick } = guard();
    // 200 different visitors in one /24, each browsing normally, within 10 s.
    let worst = 0;
    for (let i = 0; i < 200; i++) {
      const d = await hit(g, browser(`100.64.7.${i % 250}`, ["/", "/pricing", "/docs"][i % 3]));
      worst = Math.max(worst, d.score);
      tick(50);
    }
    expect(worst).toBeLessThan(30);
  });

  it("repeat offenders are blocked for longer each time", async () => {
    const { g, tick } = guard();
    await hit(g, browser("192.0.2.200", "/.env"));
    tick(6 * 60_000); // the first block (5 min) has passed
    expect((await hit(g, browser("192.0.2.200", "/"))).action).toBe("allow");
    await hit(g, browser("192.0.2.200", "/.env"));
    tick(6 * 60_000); // the second block is 20 min: still in force
    expect((await hit(g, browser("192.0.2.200", "/"))).action).toBe("block");
  });
});
