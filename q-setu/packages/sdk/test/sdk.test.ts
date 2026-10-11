import { describe, expect, it } from "vitest";
import {
  createIdentity,
  createSession,
  createSessionServer,
  generateKeys,
  openJSON,
  publicKeys,
  seal,
  sign,
  verify,
} from "../src";
import { bytesToBase64 } from "@qsetu/core";

describe("@qsetu/sdk", () => {
  it("seal → openJSON with a signature, in two lines", () => {
    const bank = generateKeys();
    const app = generateKeys();
    const box = seal({ amountINR: "500.00" }, publicKeys(bank), app);
    expect(openJSON(box, bank, publicKeys(app))).toEqual({ amountINR: "500.00" });
  });

  it("sign / verify", () => {
    const k = generateKeys("edge");
    const s = sign("mandate:42", k);
    expect(verify("mandate:42", s, publicKeys(k))).toBe(true);
    expect(verify("mandate:43", s, publicKeys(k))).toBe(false);
  });

  it("createSession talks to createSessionServer over a fetch-shaped transport", async () => {
    const identity = createIdentity();
    const server = createSessionServer({ identity });
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const path = url.split("/").pop();
      const out =
        path === "hello"
          ? server.hello(body)
          : path === "finish"
            ? server.finish(body)
            : await server.message(body, (req) => ({ echo: req }));
      return new Response(JSON.stringify(out), { headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    const s = await createSession({
      url: "http://bank/qsetu",
      serverKey: bytesToBase64(identity.publicKey),
      fetch: fakeFetch,
    });
    expect(await s.send({ payerVPA: "ravi@bharatbank" })).toEqual({
      echo: { payerVPA: "ravi@bharatbank" },
    });
    expect(s.handshake.bytesReceived).toBeGreaterThan(3000);
  });

  it("refuses a server that isn't the pinned identity", async () => {
    const server = createSessionServer({ identity: createIdentity() });
    const fakeFetch = (async (_url: string, init?: RequestInit) =>
      new Response(JSON.stringify(server.hello(JSON.parse(String(init?.body)))))) as typeof fetch;
    await expect(
      createSession({ url: "x", serverKey: createIdentity().publicKey, fetch: fakeFetch }),
    ).rejects.toThrow(/verification failed|identity/);
  });
});
