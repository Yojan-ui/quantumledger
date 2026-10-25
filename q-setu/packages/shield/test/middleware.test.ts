/** The one-line middleware in a real Express-style (node:http) server. */
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { shield } from "../src";

let server: http.Server;
let base = "";
const events: string[] = [];

beforeAll(async () => {
  const mw = shield({
    siteKey: "k".repeat(40),
    mode: "protect",
    reportTo: false,
    onEvent: (e) => events.push(e.type),
  });
  server = http.createServer((req, res) => {
    void mw(req, res, () => {
      res.setHeader("x-powered-by", "Express");
      res.end("app");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => server.close());

const browser = {
  "user-agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
  "accept-language": "en",
  accept: "text/html",
  "sec-fetch-mode": "navigate",
};

describe("shield() middleware", () => {
  it("passes normal traffic through and adds safe headers", async () => {
    const r = await fetch(`${base}/`, { headers: browser });
    expect(await r.text()).toBe("app");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  });
  it("answers a honeypot itself, without reaching the app", async () => {
    const t = Date.now();
    const r = await fetch(`${base}/.env`, {
      headers: { ...browser, "x-forwarded-for": "1.1.1.1" },
    });
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("Not found\n");
    expect(Date.now() - t).toBeGreaterThanOrEqual(2900);
    expect(events).toContain("honeypot");
  });
});
