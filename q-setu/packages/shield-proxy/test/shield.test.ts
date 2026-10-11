import { createIdentity, bytesToBase64 } from "@qsetu/core";
import { createLegacyApp } from "../../../apps/legacy-bank/src/app";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startShieldClient, startShieldServer } from "../src";

const ports = { app: 14000, server: 18443, client: 18080 };
let appServer: Server;
let server: Awaited<ReturnType<typeof startShieldServer>>;
let client: Awaited<ReturnType<typeof startShieldClient>>;
const legacyLog: string[] = [];

beforeAll(async () => {
  appServer = await new Promise<Server>((r) => {
    const s = createLegacyApp((l) => legacyLog.push(l)).listen(ports.app, "127.0.0.1", () => r(s));
  });
  const identity = createIdentity();
  server = await startShieldServer({
    upstream: `http://127.0.0.1:${ports.app}`,
    listen: ports.server,
    identity,
    log: () => {},
  });
  client = await startShieldClient({
    peer: `http://127.0.0.1:${ports.server}`,
    listen: ports.client,
    serverKey: bytesToBase64(identity.publicKey),
    log: () => {},
  });
});

afterAll(async () => {
  await client.close();
  await server.close();
  appServer.close();
});

describe("Shield proxy", () => {
  it("tunnels a request to the unmodified legacy app and returns its response", async () => {
    const res = await fetch(`http://127.0.0.1:${ports.client}/api/transfer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        payerVPA: "ravi@bharatbank",
        payeeVPA: "anjali@sahyadri",
        amountINR: "2450.00",
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "SUCCESS", payeeVPA: "anjali@sahyadri" });
    expect(res.headers.get("x-qsetu-session")).toBeTruthy();
    expect(legacyLog.some((l) => l.includes("POST /api/transfer"))).toBe(true);
  });

  it("the wire between Shields carries no plaintext", async () => {
    await fetch(`http://127.0.0.1:${ports.client}/api/transfer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payerVPA: "secret.person@bharatbank", amountINR: "99999.00" }),
    });
    const { frames } = (await (
      await fetch(`http://127.0.0.1:${ports.server}/qsetu/wire`)
    ).json()) as { frames: { kind: string }[] };
    expect(frames.map((f) => f.kind)).toEqual(
      expect.arrayContaining([
        "client-hello",
        "server-hello",
        "client-finish",
        "request",
        "response",
      ]),
    );
    expect(JSON.stringify(frames)).not.toContain("secret.person");
  });

  it("reuses one session (one handshake) for many requests", async () => {
    for (let i = 0; i < 5; i++) await fetch(`http://127.0.0.1:${ports.client}/api/health`);
    expect(client.stats.handshakes).toBe(1);
  });

  it("rejects a replayed tunnel frame", async () => {
    const s = await client.getSession();
    const { codec, utf8ToBytes } = await import("@qsetu/core");
    const msg = codec.message.toJSON(
      s.session.seal(
        utf8ToBytes(JSON.stringify({ method: "GET", path: "/api/health", headers: {} })),
      ),
    );
    const send = () =>
      fetch(`http://127.0.0.1:${ports.server}/qsetu/message`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(msg),
      });
    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(400);
  });
});
