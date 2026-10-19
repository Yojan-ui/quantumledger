/**
 * Shield Edge end to end, on loopback: a plain HTTP origin, the edge in front with a self-signed
 * certificate, and real TLS clients (post-quantum and classical, HTTP/1.1 and HTTP/2).
 */
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import http2 from "node:http2";
import https from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import tls from "node:tls";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CertStore } from "../src/certs";
import { assertPqSupport, type Edge, PQ_GROUPS, startEdge } from "../src/edge";
import { selfSigned } from "./fixtures";

const NAME = "shop.edge.test";
let origin: http.Server;
let edge: Edge;
let port = 0;
let lastOriginHeaders: http.IncomingHttpHeaders = {};
let dir = "";
const KEK = "k".repeat(40);

beforeAll(async () => {
  origin = http.createServer((req, res) => {
    lastOriginHeaders = req.headers;
    if (req.url === "/echo") {
      // Streams the body back, counting bytes, without holding it.
      res.writeHead(200, {
        "content-type": "application/octet-stream",
        server: "Apache/2.4.1",
        "x-powered-by": "PHP/5",
      });
      req.pipe(res);
      return;
    }
    res.writeHead(200, {
      "content-type": "text/plain",
      server: "Apache/2.4.1",
      "x-powered-by": "PHP/5",
    });
    res.end(`hello ${req.method} ${req.url}`);
  });
  await new Promise<void>((r) => origin.listen(0, "127.0.0.1", r));
  dir = mkdtempSync(join(tmpdir(), "edge-store-"));
  const certs = new CertStore(dir, KEK, { ecdhCurve: PQ_GROUPS, minVersion: "TLSv1.2" });
  certs.put(NAME, selfSigned([NAME]));
  edge = await startEdge({
    port: 0,
    host: "127.0.0.1",
    origin: `http://127.0.0.1:${(origin.address() as { port: number }).port}`,
    certs,
  });
  port = edge.address().port;
});
afterAll(async () => {
  await edge.close();
  origin.close();
});

function get(
  path: string,
  opts: https.RequestOptions = {},
): Promise<{
  status: number;
  body: string;
  headers: http.IncomingHttpHeaders;
  socket: tls.TLSSocket;
}> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: "127.0.0.1",
        port,
        servername: NAME,
        path,
        rejectUnauthorized: false,
        agent: false,
        headers: { host: NAME, ...(opts.headers ?? {}) },
        ...opts,
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () =>
          resolve({
            status: res.statusCode!,
            body,
            headers: res.headers,
            socket: res.socket as tls.TLSSocket,
          }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("Shield Edge", () => {
  it("passes the startup check on this Node", () => {
    expect(assertPqSupport().openssl).toMatch(/^3\.(5|[6-9])|^[4-9]/);
  });

  it("proxies over a post-quantum key exchange, and tells the origin", async () => {
    const before = edge.metrics.connections.X25519MLKEM768;
    const r = await get("/a?b=1", { ecdhCurve: "X25519MLKEM768:X25519" } as https.RequestOptions);
    expect(r.status).toBe(200);
    expect(r.body).toBe("hello GET /a?b=1");
    expect(lastOriginHeaders["x-qsetu-kx"]).toBe("X25519MLKEM768");
    expect(lastOriginHeaders["x-forwarded-proto"]).toBe("https");
    expect(edge.metrics.connections.X25519MLKEM768).toBe(before + 1);
  });

  it("falls back to X25519 for a classical client, and counts it", async () => {
    const before = edge.metrics.connections.X25519;
    const r = await get("/", { ecdhCurve: "X25519" } as https.RequestOptions);
    expect(r.status).toBe(200);
    expect(lastOriginHeaders["x-qsetu-kx"]).toBe("X25519");
    expect(edge.metrics.connections.X25519).toBe(before + 1);
  });

  it("drops forwarding headers the client tries to set, and stack-revealing response headers", async () => {
    const r = await get("/", {
      headers: {
        host: NAME,
        "x-forwarded-for": "1.2.3.4",
        "x-qsetu-kx": "X25519MLKEM768",
        "x-real-ip": "5.6.7.8",
      },
      ecdhCurve: "X25519",
    } as https.RequestOptions);
    expect(lastOriginHeaders["x-forwarded-for"]).toBe("127.0.0.1");
    expect(lastOriginHeaders["x-real-ip"]).toBeUndefined();
    expect(lastOriginHeaders["x-qsetu-kx"]).toBe("X25519");
    expect(r.headers.server).toBeUndefined();
    expect(r.headers["x-powered-by"]).toBeUndefined();
  });

  it("speaks HTTP/2", async () => {
    const s = http2.connect(`https://127.0.0.1:${port}`, {
      servername: NAME,
      rejectUnauthorized: false,
    });
    const body = await new Promise<string>((resolve, reject) => {
      const req = s.request({ ":path": "/h2", ":authority": NAME });
      let b = "";
      req.on("data", (c) => (b += c));
      req.on("end", () => resolve(b));
      req.on("error", reject);
      req.end();
    });
    s.close();
    expect(body).toBe("hello GET /h2");
  });

  it("streams a 32 MB upload through and back without buffering it", async () => {
    const size = 32 * 1024 * 1024;
    const chunk = Buffer.alloc(64 * 1024, 7);
    const got = await new Promise<number>((resolve, reject) => {
      const req = https.request(
        {
          host: "127.0.0.1",
          port,
          servername: NAME,
          path: "/echo",
          method: "POST",
          rejectUnauthorized: false,
          agent: false,
          headers: { host: NAME },
        },
        (res) => {
          let n = 0;
          res.on("data", (c: Buffer) => (n += c.length));
          res.on("end", () => resolve(n));
        },
      );
      req.on("error", reject);
      let sent = 0;
      const pump = () => {
        while (sent < size) {
          sent += chunk.length;
          if (!req.write(chunk)) return void req.once("drain", pump);
        }
        req.end();
      };
      pump();
    });
    expect(got).toBe(size);
  });

  it("resumes TLS sessions with tickets, until the ticket key rotates", async () => {
    const connect = (session?: Buffer) =>
      new Promise<{ reused: boolean; session?: Buffer }>((resolve, reject) => {
        let saved: Buffer | undefined;
        const c = tls.connect(
          {
            host: "127.0.0.1",
            port,
            servername: NAME,
            rejectUnauthorized: false,
            ...(session ? { session } : {}),
          },
          () => {
            c.write(`GET / HTTP/1.1\r\nHost: ${NAME}\r\nConnection: close\r\n\r\n`);
          },
        );
        c.on("session", (s) => (saved = s));
        c.on("data", () => {});
        c.on("end", () =>
          resolve({ reused: c.isSessionReused(), ...(saved ? { session: saved } : {}) }),
        );
        c.on("error", reject);
      });
    const first = await connect();
    expect(first.session).toBeDefined();
    const before = edge.metrics.resumed;
    const second = await connect(first.session);
    expect(second.reused).toBe(true);
    expect(edge.metrics.resumed).toBe(before + 1);
    edge.rotateTickets();
    const third = await connect(first.session);
    expect(third.reused).toBe(false);
  });

  it("answers 502, plainly, when the origin is down", async () => {
    const certs = new CertStore(dir, KEK, { ecdhCurve: PQ_GROUPS, minVersion: "TLSv1.2" });
    const e2 = await startEdge({ port: 0, host: "127.0.0.1", origin: "http://127.0.0.1:1", certs });
    const r = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      https
        .get(
          {
            host: "127.0.0.1",
            port: e2.address().port,
            servername: NAME,
            rejectUnauthorized: false,
            agent: false,
            headers: { host: NAME },
          },
          (res) => {
            let b = "";
            res.on("data", (c) => (b += c));
            res.on("end", () => resolve({ status: res.statusCode!, body: b }));
          },
        )
        .on("error", reject);
    });
    await e2.close();
    expect(r.status).toBe(502);
    expect(r.body).toBe("Bad gateway\n");
  });

  it("lets the guard hook answer instead of the origin", async () => {
    const certs = new CertStore(dir, KEK, { ecdhCurve: PQ_GROUPS, minVersion: "TLSv1.2" });
    const e3 = await startEdge({
      port: 0,
      host: "127.0.0.1",
      origin: "http://127.0.0.1:1",
      certs,
      guard: (g) =>
        g.path === "/.env"
          ? { action: "respond", status: 404, body: "Not found\n" }
          : { action: "allow" },
    });
    const r = await new Promise<number>((resolve, reject) => {
      https
        .get(
          {
            host: "127.0.0.1",
            port: e3.address().port,
            path: "/.env",
            servername: NAME,
            rejectUnauthorized: false,
            agent: false,
            headers: { host: NAME },
          },
          (res) => {
            res.resume();
            res.on("end", () => resolve(res.statusCode!));
          },
        )
        .on("error", reject);
    });
    await e3.close();
    expect(r).toBe(404);
  });
});

describe("CertStore", () => {
  it("never writes the private key in the clear, and rejects a tampered record", () => {
    const d = mkdtempSync(join(tmpdir(), "edge-store-"));
    const s = new CertStore(d, KEK, { ecdhCurve: PQ_GROUPS, minVersion: "TLSv1.2" });
    const pair = selfSigned(["a.edge.test"]);
    s.put("a.edge.test", pair);
    const file = join(d, readdirSync(d)[0]!);
    const raw = readFileSync(file, "utf8");
    expect(raw).not.toContain("PRIVATE KEY");
    expect(s.get("a.edge.test")?.key).toBe(pair.key);
    // A record copied onto another domain's name fails (the domain is bound into the encryption).
    const rec = JSON.parse(raw);
    writeFileSync(join(d, "b.edge.test.json"), JSON.stringify({ ...rec, domain: "b.edge.test" }));
    expect(() => s.get("b.edge.test")).toThrow();
    // The wrong key-encryption key can't read it.
    const wrong = new CertStore(d, "x".repeat(40), { ecdhCurve: PQ_GROUPS, minVersion: "TLSv1.2" });
    expect(() => wrong.get("a.edge.test")).toThrow();
  });

  it("refuses a short key-encryption key", () => {
    expect(
      () =>
        new CertStore(mkdtempSync(join(tmpdir(), "e-")), "short", {
          ecdhCurve: PQ_GROUPS,
          minVersion: "TLSv1.2",
        }),
    ).toThrow();
  });
});
