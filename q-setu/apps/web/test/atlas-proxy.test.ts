/**
 * /atlas-api/* proxy (lib/server/atlas-proxy.ts) against a fake Atlas on a random local port: Origin refusal,
 * cookie pass-through, CSRF + upstream origin, unbuffered SSE, and 503 atlas_down when nothing listens.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { proxy } from "@/lib/server/atlas-proxy";

type Seen = { method?: string; url?: string; headers?: IncomingMessage["headers"]; body?: string };
let seen: Seen = {};
let releaseStream: () => void = () => {};
let server: Server;
let atlas = "";

function fake(req: IncomingMessage, res: ServerResponse) {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    seen = { method: req.method, url: req.url, headers: req.headers, body };
    if (req.url?.startsWith("/api/events")) {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write("event: hello\ndata: 1\n\n");
      releaseStream = () => res.end("event: bye\ndata: 2\n\n");
      return;
    }
    res.setHeader("set-cookie", [
      "atlas_session=s1; HttpOnly; SameSite=Strict; Path=/",
      "atlas_csrf=c1; SameSite=Strict; Path=/",
    ]);
    res.writeHead(req.url === "/api/missing" ? 404 : 200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, url: req.url }));
  });
}

const call = (
  method: string,
  path: string,
  init: { headers?: Record<string, string>; body?: string; signal?: AbortSignal } = {},
) =>
  proxy(
    new Request(`http://localhost:3000/atlas-api/${path}`, {
      method,
      headers: { host: "localhost:3000", ...init.headers },
      body: init.body,
      signal: init.signal,
    }),
    { params: Promise.resolve({ path: (path.split("?")[0] ?? "").split("/") }) },
  );

beforeAll(async () => {
  server = createServer(fake);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  atlas = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.ATLAS_URL = atlas;
});
afterAll(() => {
  releaseStream();
  server.close();
});

describe("/atlas-api proxy", () => {
  it("refuses a cross-origin request before contacting Atlas", async () => {
    seen = {};
    const r = await call("POST", "auth/login", {
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      body: "{}",
    });
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe("bad_origin");
    expect(seen.url).toBeUndefined();
  });

  it("forwards path, query, cookies and CSRF; sends Atlas its own origin", async () => {
    const r = await call("POST", "workspaces/demo/runs?x=1", {
      headers: {
        origin: "http://localhost:3000",
        cookie: "atlas_session=s0; atlas_csrf=c0",
        "x-csrf-token": "c0",
        "content-type": "application/json",
      },
      body: JSON.stringify({ probes: [] }),
    });
    expect(r.status).toBe(200);
    expect(seen.url).toBe("/api/workspaces/demo/runs?x=1");
    expect(seen.headers?.cookie).toBe("atlas_session=s0; atlas_csrf=c0");
    expect(seen.headers?.["x-csrf-token"]).toBe("c0");
    expect(seen.headers?.origin).toBe(atlas);
    expect(new URL(seen.headers?.origin as string).host).toBe(seen.headers?.host); // Atlas's check_origin() passes
    expect(seen.headers?.["content-length"]).toBe(String(JSON.stringify({ probes: [] }).length)); // buffered, not chunked
    expect(seen.body).toBe(JSON.stringify({ probes: [] }));
    expect(seen.headers?.connection).toBe("close"); // no unread body can poison the next request
  });

  it("passes every Set-Cookie and the upstream status back", async () => {
    const r = await call("GET", "me");
    expect(r.headers.getSetCookie()).toEqual([
      "atlas_session=s1; HttpOnly; SameSite=Strict; Path=/",
      "atlas_csrf=c1; SameSite=Strict; Path=/",
    ]);
    expect((await call("GET", "missing")).status).toBe(404);
  });

  it("streams SSE without waiting for the upstream to finish", async () => {
    const r = await call("GET", "events?ws=demo");
    expect(r.headers.get("content-type")).toMatch(/^text\/event-stream/);
    expect(r.headers.get("cache-control")).toBe("no-cache, no-transform");
    const reader = r.body!.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    expect(first).toContain("event: hello"); // arrived while the upstream response is still open
    releaseStream();
    let rest = "";
    for (let c = await reader.read(); !c.done; c = await reader.read())
      rest += new TextDecoder().decode(c.value);
    expect(rest).toContain("event: bye");
  });

  it("returns 503 atlas_down when nothing listens on ATLAS_URL", async () => {
    const saved = process.env.ATLAS_URL;
    const idle = createServer();
    await new Promise<void>((r) => idle.listen(0, "127.0.0.1", r));
    const port = (idle.address() as AddressInfo).port;
    await new Promise<void>((r) => idle.close(() => r()));
    process.env.ATLAS_URL = `http://127.0.0.1:${port}`;
    try {
      const r = await call("GET", "health");
      expect(r.status).toBe(503);
      expect(await r.json()).toEqual({
        error: { code: "atlas_down", message: "Q-Shield backend isn't running on :8100" },
      });
    } finally {
      process.env.ATLAS_URL = saved;
    }
  });
});
