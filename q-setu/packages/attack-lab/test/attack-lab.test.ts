import { request } from "node:http";
import { createIdentity } from "@qsetu/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertSandbox,
  buildTimeline,
  classify,
  createSigner,
  EvidenceStore,
  HostRefused,
  replay,
  sandboxUrl,
  simulate,
  startLabServer,
  startSandbox,
  stepsFromTimeline,
  verifyRecord,
  type AttackEvent,
  type Sandbox,
} from "../src";

const signer = createSigner(createIdentity("standard"));

const ev = (o: Partial<AttackEvent> = {}): AttackEvent => ({
  site: "s1",
  at: 1_000,
  source: { ipHash: "aaaa", netHash: "nnnn" },
  client: "script",
  method: "GET",
  route: "/.env",
  flagged: true,
  types: ["honeypot"],
  signals: ["honeypot"],
  score: 100,
  action: "block",
  status: 404,
  monitorOnly: false,
  synthetic: true,
  ...o,
});

describe("evidence store", () => {
  it("links by source, signs every record and chains them", () => {
    const s = new EvidenceStore({ signer });
    s.append(ev());
    s.append(ev({ at: 2_000, route: "/.git/config" }));
    s.append(ev({ at: 3_000, source: { ipHash: "bbbb", netHash: "nnnn" } }));
    s.sealDirty();
    const incs = s.listIncidents();
    expect(incs).toHaveLength(2);
    expect(incs.find((i) => i.ipHashes.includes("aaaa"))!.eventIds).toHaveLength(2);
    expect(s.verify().ok).toBe(true);
    for (const i of incs) expect(s.verifyIncident(i.id)!.ok).toBe(true);
  });

  it("joins a new source to an incident through a shared session", () => {
    const s = new EvidenceStore({ signer });
    s.append(ev({ source: { ipHash: "aaaa", netHash: "n", sessionHash: "sess" } }));
    s.append(ev({ at: 5_000, source: { ipHash: "cccc", netHash: "n", sessionHash: "sess" } }));
    expect(s.listIncidents()).toHaveLength(1);
  });

  it("detects tampering and can't be changed through what it returns", () => {
    const s = new EvidenceStore({ signer });
    const r = s.append(ev());
    expect(() => {
      (r.body as { route: string }).route = "/";
    }).toThrow();
    const forged = { ...r, body: { ...r.body, score: 1 } };
    expect(verifyRecord(forged, s.publicKey)).toEqual({ ok: false, reason: "hash" });
    const other = createSigner(createIdentity("standard"));
    expect(verifyRecord(r, other.publicKey)).toEqual({ ok: false, reason: "key" });
  });
});

describe("timeline and patterns", () => {
  it("orders steps and names the pattern", () => {
    const s = new EvidenceStore({ signer });
    s.append(
      ev({
        flagged: false,
        types: [],
        signals: [],
        score: 0,
        action: "allow",
        route: "/",
        status: 200,
      }),
    );
    s.append(ev({ at: 1_500 }));
    const [inc] = s.listIncidents();
    const t = buildTimeline(inc!.id, s.eventsOf(inc!.id));
    expect(t.steps.map((x) => x.phase)).toEqual(["browse", "probe"]);
    expect(t.firstStop).toBe(1);
    expect(classify(inc!, s.eventsOf(inc!.id)).name).toBe("Secrets probe");
  });
});

describe("host guard", () => {
  it("allows loopback only", () => {
    expect(assertSandbox("http://127.0.0.1:4101").hostname).toBe("127.0.0.1");
    expect(assertSandbox("http://localhost:4000/x").hostname).toBe("localhost");
    for (const bad of [
      "http://example.com",
      "https://10.0.0.5",
      "http://127.0.0.1.nip.io",
      "http://user@127.0.0.1",
      "file:///etc/passwd",
      "not a url",
    ])
      expect(() => assertSandbox(bad)).toThrow(HostRefused);
  });

  it("keeps protocol-relative routes on the sandbox", () => {
    expect(new URL(sandboxUrl("http://127.0.0.1:4101", "//evil.example/x")).hostname).toBe(
      "127.0.0.1",
    );
  });

  it("refuses a replay to another host before sending anything", async () => {
    let calls = 0;
    const f = (async () => {
      calls++;
      return new Response("");
    }) as typeof fetch;
    await expect(
      replay([], { bare: "http://127.0.0.1:1", protected: "https://bank.example" }, { fetch: f }),
    ).rejects.toThrow(HostRefused);
    expect(calls).toBe(0);
  });
});

describe("end to end on the sandbox", () => {
  let live: Sandbox;
  let store: EvidenceStore;
  beforeAll(async () => {
    store = new EvidenceStore({ signer, sealDelayMs: 10 });
    live = await startSandbox({ record: { store, salt: "test-salt-0123456789" } });
  });
  afterAll(async () => {
    store.close();
    await live.close();
  });

  it("records flagged traffic, not ordinary visits, and Shield stops the replay", async () => {
    await simulate(live.protected, live, ["secrets-probe", "ordinary-visitor"]);
    store.sealDirty();
    const incs = store.listIncidents();
    expect(incs).toHaveLength(1);
    const inc = incs[0]!;
    expect(classify(inc, store.eventsOf(inc.id)).id).toBe("secrets-probe");
    const events = store.eventsOf(inc.id).map((e) => e.body);
    expect(events.every((e) => e.synthetic && !JSON.stringify(e).includes("203.0.113"))).toBe(true);
    expect(store.verifyIncident(inc.id)!.ok).toBe(true);

    const box = await startSandbox();
    try {
      const steps = stepsFromTimeline(buildTimeline(inc.id, store.eventsOf(inc.id))).filter(
        (s) => s.route !== "/backup.zip" && s.route !== "/.aws/credentials",
      );
      const r = await replay(steps, box, { maxGapMs: 0 });
      expect(r.summary.protected.blocked).toBeGreaterThan(0);
      expect(r.summary.bare.served + r.summary.bare["not found"]).toBe(steps.length);
      // After the first honeypot, the protected copy refuses even the real home page.
      expect(r.steps.at(-1)!.route).toBe("/");
      expect(r.steps.at(-1)!.bare.outcome).toBe("served");
      expect(r.steps.at(-1)!.protected.outcome).toBe("blocked");
    } finally {
      await box.close();
    }
  }, 60_000);
});

describe("engine API: server to server only", () => {
  let live: Sandbox;
  let store: EvidenceStore;
  let api: { url: string; close(): Promise<void> };
  beforeAll(async () => {
    store = new EvidenceStore({ signer, sealDelayMs: 10 });
    live = await startSandbox();
    api = await startLabServer({ store, sandbox: live, port: 0 });
  });
  afterAll(async () => {
    await api.close();
    store.close();
    await live.close();
  });
  // node:http, not fetch: a browser-like Host header has to be set by hand.
  const get = (headers: Record<string, string>) =>
    new Promise<number>((resolve, reject) => {
      const u = new URL("/api/overview", api.url);
      request({ host: u.hostname, port: u.port, path: u.pathname, headers }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      })
        .on("error", reject)
        .end();
    });

  it("answers the web app's server (a loopback Host, no browser headers)", async () => {
    expect(await get({})).toBe(200);
    expect(await get({ host: `localhost:${new URL(api.url).port}` })).toBe(200);
  });

  it("refuses a rebound hostile name, and anything a browser sends", async () => {
    expect(await get({ host: "evil.example:4100" })).toBe(403);
    expect(await get({ origin: "https://evil.example" })).toBe(403);
    expect(await get({ "sec-fetch-site": "cross-site" })).toBe(403);
  });
});
