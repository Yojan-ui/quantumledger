/**
 * Shield tunnel v2 end to end on loopback (an echo origin, the server node, the client node), and its
 * record layer on its own: tampering, truncation, reordering and wrong keys must all fail.
 */
import { createHash, randomBytes } from "node:crypto";
import http from "node:http";
import { PassThrough } from "node:stream";
import { bytesToBase64, createIdentity } from "@qsetu/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTunnelClient, startTunnelServer } from "../src";
import { newStreamNonce, Opener, preamble, Sealer, streamKey } from "../src/v2/frames";
import { RecvKeys, SendKeys, TicketKeys } from "../src/v2/keys";

let origin: http.Server;
let server: Awaited<ReturnType<typeof startTunnelServer>>;
let client: Awaited<ReturnType<typeof startTunnelClient>>;
let base = "";
let lastHeaders: http.IncomingHttpHeaders = {};
const identity = createIdentity();

beforeAll(async () => {
  origin = http.createServer((req, res) => {
    lastHeaders = req.headers;
    if (req.url === "/echo") {
      // Hashes the body as it streams and returns it; never holds the whole body.
      const h = createHash("sha256");
      let n = 0;
      req.on("data", (c: Buffer) => {
        h.update(c);
        n += c.length;
      });
      req.on("end", () => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ n, sha: h.digest("hex") }));
      });
      return;
    }
    if (req.url === "/big") {
      res.writeHead(200, { "content-type": "application/octet-stream" });
      const chunk = Buffer.alloc(256 * 1024, 1);
      let left = 64; // 16 MB
      const pump = () => {
        while (left > 0) {
          left--;
          if (!res.write(chunk)) return void res.once("drain", pump);
        }
        res.end();
      };
      return pump();
    }
    res.writeHead(201, { "content-type": "text/plain", "x-app": "legacy" });
    res.end(`hi ${req.method} ${req.url}`);
  });
  await new Promise<void>((r) => origin.listen(0, "127.0.0.1", r));
  server = await startTunnelServer({
    upstream: `http://127.0.0.1:${(origin.address() as { port: number }).port}`,
    listen: 0,
    identity,
    log: () => {},
  });
  client = await startTunnelClient({
    peer: `http://127.0.0.1:${server.port()}`,
    listen: 0,
    serverKey: bytesToBase64(identity.publicKey),
    log: () => {},
  });
  base = `http://127.0.0.1:${client.port()}`;
});
afterAll(async () => {
  await client.close();
  await server.close();
  origin.close();
});

describe("Shield tunnel v2", () => {
  it("carries a request and its response, headers included", async () => {
    const r = await fetch(`${base}/a/b?c=1`, { headers: { "x-test": "yes" } });
    expect(r.status).toBe(201);
    expect(await r.text()).toBe("hi GET /a/b?c=1");
    expect(r.headers.get("x-app")).toBe("legacy");
    expect(lastHeaders["x-test"]).toBe("yes");
  });

  it("streams a 48 MB upload intact (no 10 MB cap, no base64)", async () => {
    const size = 48 * 1024 * 1024;
    const body = randomBytes(size);
    const r = await fetch(`${base}/echo`, { method: "POST", body });
    const j = (await r.json()) as { n: number; sha: string };
    expect(j.n).toBe(size);
    expect(j.sha).toBe(createHash("sha256").update(body).digest("hex"));
  });

  it("streams a 16 MB download", async () => {
    const r = await fetch(`${base}/big`);
    expect((await r.arrayBuffer()).byteLength).toBe(16 * 1024 * 1024);
  });

  it("runs many requests at once over one connection and one handshake", async () => {
    const before = client.stats.handshakes + client.stats.resumptions;
    const rs = await Promise.all(
      Array.from({ length: 200 }, (_, i) => fetch(`${base}/p${i}`).then((r) => r.text())),
    );
    rs.forEach((t, i) => expect(t).toBe(`hi GET /p${i}`));
    expect(client.stats.handshakes + client.stats.resumptions).toBe(before);
  });

  it("resumes with a ticket after a disconnect, without a new ML-KEM / ML-DSA handshake", async () => {
    const full = client.stats.handshakes;
    client.disconnect();
    const r = await fetch(`${base}/again`);
    expect(await r.text()).toBe("hi GET /again");
    expect(client.stats.handshakes).toBe(full);
    expect(client.stats.resumptions).toBeGreaterThan(0);
  });

  it("refuses to talk to a server whose key isn't the pinned one", async () => {
    const other = await startTunnelClient({
      peer: `http://127.0.0.1:${server.port()}`,
      listen: 0,
      serverKey: bytesToBase64(createIdentity().publicKey),
      log: () => {},
    });
    const r = await fetch(`http://127.0.0.1:${other.port()}/x`);
    await other.close();
    expect(r.status).toBe(502);
  });

  it("requires a pinned key", async () => {
    await expect(
      startTunnelClient({ peer: "http://127.0.0.1:1", listen: 0, serverKey: "", log: () => {} }),
    ).rejects.toThrow(/SHIELD_PEER_KEY/);
  });

  it("does not serve its identity key unless demo mode is on", async () => {
    const h2 = await import("node:http2");
    const s = h2.connect(`http://127.0.0.1:${server.port()}`);
    const status = await new Promise<number>((resolve) => {
      const q = s.request({ ":path": "/qsetu/identity" });
      q.on("response", (h) => resolve(Number(h[":status"])));
      q.resume();
    });
    s.close();
    expect(status).toBe(404);
  });
});

/** Seal a body, optionally mangle the bytes, and try to open it. */
async function roundTrip(mangle?: (b: Buffer) => Buffer, keyOverride?: Buffer) {
  const k = randomBytes(32);
  const nonce = newStreamNonce();
  const sealer = new Sealer(streamKey(k, nonce, "c2s"), "c2s", preamble(nonce, 0));
  sealer.head({ method: "GET", path: "/", headers: {} });
  const parts: Buffer[] = [];
  sealer.on("data", (c: Buffer) => parts.push(c));
  sealer.end(Buffer.alloc(200_000, 9));
  await new Promise((r) => sealer.on("end", r));
  let wire: Buffer = Buffer.concat(parts);
  if (mangle) wire = mangle(wire);
  const opener = new Opener("c2s", (n) => streamKey(keyOverride ?? k, n, "c2s"));
  const src = new PassThrough();
  src.pipe(opener);
  src.end(wire);
  return new Promise<number>((resolve, reject) => {
    let n = 0;
    opener.on("data", (c: Buffer) => (n += c.length));
    opener.on("end", () => resolve(n));
    opener.on("error", reject);
  });
}

describe("Tunnel v2 record layer", () => {
  it("opens what it sealed", async () => {
    expect(await roundTrip()).toBe(200_000);
  });
  it("rejects a flipped bit", async () => {
    await expect(roundTrip((b) => ((b[b.length - 100]! ^= 1), b))).rejects.toThrow(
      /authentication/,
    );
  });
  it("rejects a truncated stream (END frame cut off)", async () => {
    await expect(roundTrip((b) => b.subarray(0, b.length - 21))).rejects.toThrow(/truncated/);
  });
  it("rejects frames swapped in order", async () => {
    // Frames 2 and 3 are both full 64 KiB DATA frames: swap them.
    const swap = (b: Buffer) => {
      let p = 20;
      const frames: Buffer[] = [];
      while (p < b.length) {
        const len = b.readUInt32BE(p);
        frames.push(b.subarray(p, p + 4 + len));
        p += 4 + len;
      }
      [frames[1], frames[2]] = [frames[2]!, frames[1]!];
      return Buffer.concat([b.subarray(0, 20), ...frames]);
    };
    await expect(roundTrip(swap)).rejects.toThrow(/authentication/);
  });
  it("rejects the wrong key", async () => {
    await expect(roundTrip(undefined, randomBytes(32))).rejects.toThrow(/authentication/);
  });
});

describe("Tunnel v2 keys", () => {
  it("ratchets every 1,000 streams, and the receiver follows", () => {
    const k = randomBytes(32);
    const send = new SendKeys(Buffer.from(k));
    const recv = new RecvKeys(Buffer.from(k));
    let last = send.next();
    for (let i = 0; i < 2500; i++) last = send.next();
    expect(last.epoch).toBe(2);
    expect(recv.keyFor(2)?.equals(last.key)).toBe(true);
    // The previous epoch still opens (streams in flight); older ones don't.
    expect(recv.keyFor(1)).toBeDefined();
    expect(recv.keyFor(0)).toBeUndefined();
  });
  it("tickets open with the current or previous key, not after two rotations", () => {
    const t = new TicketKeys();
    const secret = randomBytes(32);
    const ticket = t.seal(secret);
    expect(t.open(ticket)?.equals(secret)).toBe(true);
    t.rotate();
    expect(t.open(ticket)?.equals(secret)).toBe(true);
    t.rotate();
    expect(t.open(ticket)).toBeUndefined();
    t.stop();
  });
});
