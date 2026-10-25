/**
 * The ClientHello reader against real handshakes from this Node's OpenSSL: whatever group the
 * client actually ends up with must be the one negotiatedGroup() predicted from the hello alone.
 */
import net from "node:net";
import tls from "node:tls";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PQ_GROUPS } from "../src/edge";
import { ja4, negotiatedGroup, parseClientHello, recordLength } from "../src/hello";
import { selfSigned } from "./fixtures";

let port = 0;
let server: net.Server;
const hellos: Buffer[] = [];

beforeAll(async () => {
  const pair = selfSigned(["edge.test"]);
  const tlsServer = tls.createServer({ ...pair, ecdhCurve: PQ_GROUPS }, (s) => s.end("ok"));
  // Capture each connection's first record, then let TLS carry on.
  server = net.createServer({ pauseOnConnect: true }, (sock) => {
    let buf = Buffer.alloc(0);
    const on = (c: Buffer) => {
      buf = Buffer.concat([buf, c]);
      const need = recordLength(buf);
      if (need === 0 || (need !== undefined && buf.length < need)) return;
      sock.off("data", on);
      sock.pause();
      hellos.push(buf);
      sock.unshift(buf);
      tlsServer.emit("connection", sock);
    };
    sock.on("data", on);
    sock.resume();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as net.AddressInfo).port;
});
afterAll(() => server.close());

function handshake(opts: tls.ConnectionOptions): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const c = tls.connect(
      { port, host: "127.0.0.1", servername: "edge.test", rejectUnauthorized: false, ...opts },
      () => {
        const info = c.getEphemeralKeyInfo() as { name?: string } | null;
        c.on("data", () => {});
        c.on("end", () => resolve(info?.name));
      },
    );
    c.on("error", reject);
  });
}

describe("ClientHello", () => {
  const cases: [string, tls.ConnectionOptions, string][] = [
    ["a PQ-first client", { ecdhCurve: "X25519MLKEM768:X25519" }, "X25519MLKEM768"],
    // Supports PQ but sends only an X25519 key share first: the edge still gets PQ (one HelloRetry).
    [
      "a client that prefers X25519 but supports PQ",
      { ecdhCurve: "X25519:X25519MLKEM768" },
      "X25519MLKEM768",
    ],
    ["a classical-only client", { ecdhCurve: "X25519" }, "X25519"],
    // (A TLS 1.2 client must list P-256 to accept an ECDSA P-256 certificate; real ones do.)
    ["a TLS 1.2 client", { ecdhCurve: "X25519:P-256", maxVersion: "TLSv1.2" }, "X25519"],
    ["an old client without X25519", { ecdhCurve: "P-256" }, "prime256v1"],
  ];
  for (const [name, opts, expected] of cases)
    it(`predicts the group for ${name}`, async () => {
      const n = hellos.length;
      const actual = await handshake(opts);
      expect(actual).toBe(expected);
      const hello = parseClientHello(hellos[n]!);
      expect(hello?.sni).toBe("edge.test");
      // TLS 1.2 has no hybrid group: counted as classical ("other" = not a TLS 1.3 group choice).
      const predicted = negotiatedGroup(hello!);
      const pq = expected === "X25519MLKEM768";
      expect(predicted === "X25519MLKEM768").toBe(pq);
      if (expected === "X25519" && !opts.maxVersion) expect(predicted).toBe("X25519");
    });

  it("computes a JA4 fingerprint of the right shape", async () => {
    const n = hellos.length;
    await handshake({ ecdhCurve: "X25519MLKEM768:X25519", ALPNProtocols: ["h2", "http/1.1"] });
    const fp = ja4(parseClientHello(hellos[n]!)!);
    expect(fp).toMatch(/^t13d\d{4}h2_[0-9a-f]{12}_[0-9a-f]{12}$/);
  });

  it("returns undefined for garbage and for truncated hellos", () => {
    expect(parseClientHello(Buffer.from("GET / HTTP/1.1\r\n\r\n"))).toBeUndefined();
    const real = hellos[0]!;
    expect(parseClientHello(real.subarray(0, 60))).toBeUndefined();
    const lying = Buffer.from(real);
    lying[9] = 0xff; // handshake length far beyond the record
    expect(() => parseClientHello(lying)).not.toThrow();
  });
});
