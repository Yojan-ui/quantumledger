/**
 * The URL scanner's SSRF attack list (security phase 1). Every case must be blocked before any
 * connection to a non-public address is attempted. DNS and the socket are stubbed, so the tests
 * prove the checks, not the network.
 */
import { createServer, type Server } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  isPrivateAddress,
  probeTls,
  ScanError,
  SCAN_DEADLINE_MS,
  type RawTls,
} from "@/lib/live/tls";

const ok: RawTls = {
  protocol: "TLSv1.3",
  cipher: { name: "TLS_AES_128_GCM_SHA256", standardName: "TLS_AES_128_GCM_SHA256" },
  ephemeral: { type: "TLSGroup", name: "X25519MLKEM768" },
  cert: { keyType: "ec", curve: "prime256v1" },
};

/** Records every address the scanner tries to connect to. */
function spy(answer: Record<string, string[]>) {
  const connected: string[] = [];
  return {
    connected,
    deps: {
      lookup: async (host: string) => (answer[host] ?? []).map((address) => ({ address })),
      connect: async (address: string) => {
        connected.push(address);
        return ok;
      },
    },
  };
}

async function blocked(input: string, answer: Record<string, string[]> = {}) {
  const s = spy(answer);
  const err = await probeTls(input, s.deps).then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err, `${input} should be blocked`).toBeInstanceOf(ScanError);
  // Never a connection to anything that isn't a checked public address.
  expect(s.connected.filter(isPrivateAddress)).toEqual([]);
  return { err: err as ScanError, connected: s.connected };
}

describe("URL scanner: the SSRF attack list", () => {
  it("blocks http://127.0.0.1 (loopback)", async () => {
    const { err, connected } = await blocked("http://127.0.0.1");
    expect(err.code).toBe("blocked_target");
    expect(connected).toEqual([]);
  });

  it("blocks the cloud metadata service, http://169.254.169.254/latest/meta-data", async () => {
    const { err, connected } = await blocked("http://169.254.169.254/latest/meta-data");
    expect(err.code).toBe("blocked_target");
    expect(connected).toEqual([]);
  });

  it("blocks http://[::1] (IPv6 loopback)", async () => {
    expect((await blocked("http://[::1]")).err.code).toBe("blocked_target");
  });

  it("blocks a public-looking domain that resolves to 10.0.0.1", async () => {
    const { err, connected } = await blocked("intranet-trick.example.com", {
      "intranet-trick.example.com": ["10.0.0.1"],
    });
    expect(err.code).toBe("blocked_target");
    expect(connected).toEqual([]);
  });

  it("blocks a domain where any one record is private (split horizon / rebinding)", async () => {
    const { err } = await blocked("rebind.example.com", {
      "rebind.example.com": ["93.184.215.14", "127.0.0.1"],
    });
    expect(err.code).toBe("blocked_target");
  });

  it("can't be redirected to localhost: no HTTP request is ever made, so no redirect is followed", async () => {
    // A server that would answer "302 Location: http://127.0.0.1/" is never asked for a page: the
    // scanner only completes a TLS handshake with the checked address, then closes.
    const s = spy({ "redirector.example.com": ["93.184.215.14"] });
    await probeTls("https://redirector.example.com/redirect?to=http://127.0.0.1/", s.deps);
    expect(s.connected).toEqual(["93.184.215.14"]);
    // And the redirect target itself, given directly, is blocked.
    expect((await blocked("http://localhost/")).err.code).toBe("blocked_target");
  });

  it("blocks IPv4-mapped and tunnelled IPv6 forms of private addresses", async () => {
    for (const a of [
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "::ffff:a9fe:a9fe",
      "2002:7f00:1::",
      "64:ff9b::a00:1",
      "fd00::1",
      "fe80::1",
    ])
      expect(isPrivateAddress(a), a).toBe(true);
    expect((await blocked("http://[::ffff:127.0.0.1]/")).err.code).toBe("blocked_target");
  });

  it("allows only https/http, and only ports 443/80", async () => {
    for (const bad of [
      "file:///etc/passwd",
      "gopher://example.com:70/",
      "ftp://example.com/",
      "data:text/html,<script>alert(1)</script>",
      "javascript:alert(1)",
      "ws://example.com/",
    ])
      expect((await blocked(bad)).err.code, bad).toBe("invalid_input");
    for (const bad of ["https://example.com:8443/", "example.com:22", "http://example.com:6379"])
      expect((await blocked(bad, { "example.com": ["93.184.215.14"] })).err.code, bad).toBe(
        "blocked_target",
      );
  });

  it("never echoes internal error detail to the client", async () => {
    const err = await probeTls("down.example.com", {
      lookup: async () => [{ address: "93.184.215.14" }],
      connect: async () => {
        throw new Error("connect ECONNREFUSED 93.184.215.14:443");
      },
    }).then(
      () => undefined,
      (e: unknown) => e as ScanError,
    );
    expect(err?.code).toBe("unreachable");
    expect(err?.message).not.toMatch(/ECONN|93\.184/);
  });
});

describe("URL scanner: limits on the real socket", () => {
  // A local server stands in for a hostile site. The socket step is called directly (on the
  // loopback, which probeTls itself would refuse) to check the byte cap and the deadline.
  let server: Server;
  let port = 0;
  beforeAll(async () => {
    server = createServer((sock) => {
      // Stream junk forever: far more than a TLS handshake needs.
      const chunk = Buffer.alloc(64 * 1024, 0x16);
      const pump = () => {
        while (sock.writable && sock.write(chunk));
      };
      sock.on("drain", pump);
      sock.on("error", () => {});
      pump();
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    port = (server.address() as { port: number }).port;
  });
  afterAll(() => server.close());

  it("stops a huge response at 1 MB (or the deadline) instead of reading it", async () => {
    const { connectForTest } = await import("@/lib/live/tls");
    const t = Date.now();
    const err = await connectForTest(
      "127.0.0.1",
      "huge.example",
      Date.now() + SCAN_DEADLINE_MS,
      port,
    ).catch((e: ScanError) => e);
    expect(err).toBeInstanceOf(ScanError);
    expect(["too_large", "unreachable"]).toContain((err as ScanError).code);
    expect(Date.now() - t).toBeLessThan(SCAN_DEADLINE_MS + 500);
  });

  it("gives up at the 5 s deadline on a server that never answers", async () => {
    const silent = createServer(() => {});
    await new Promise<void>((r) => silent.listen(0, "127.0.0.1", () => r()));
    const p = (silent.address() as { port: number }).port;
    const { connectForTest } = await import("@/lib/live/tls");
    const t = Date.now();
    const err = await connectForTest("127.0.0.1", "slow.example", Date.now() + 600, p).catch(
      (e: ScanError) => e,
    );
    silent.close();
    expect((err as ScanError).code).toBe("timeout");
    expect(Date.now() - t).toBeLessThan(1500);
  });
});
