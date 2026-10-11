import { describe, expect, it } from "vitest";
import {
  clientFinish,
  clientHello,
  codec,
  createIdentity,
  decodeMessage,
  encodeMessage,
  serverComplete,
  serverRespond,
  SessionError,
  utf8ToBytes,
  type ProfileId,
  type SessionOptions,
} from "../src";

function handshake(profile: ProfileId = "standard", opts: SessionOptions = {}) {
  const identity = createIdentity(profile);
  const c = clientHello(profile);
  const s = serverRespond(c.hello, identity);
  const f = clientFinish(c.state, s.serverHello, identity.publicKey, opts);
  return { client: f.session, server: serverComplete(s.pending, f.finish, opts), identity };
}

function expectReason(fn: () => unknown, reason: SessionError["reason"]) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(SessionError);
    expect((e as SessionError).reason).toBe(reason);
    return;
  }
  throw new Error("expected failure");
}

const msg = utf8ToBytes('{"reading":72,"unit":"bpm"}');

describe("session", () => {
  it.each(["standard", "edge"] as const)("%s: handshake then bidirectional messages", (profile) => {
    const { client, server } = handshake(profile);
    expect(client.id).toBe(server.id);
    expect(server.open(client.seal(msg))).toEqual(msg);
    expect(client.open(server.seal(msg))).toEqual(msg);
  });

  it("handshake survives JSON transport", () => {
    const identity = createIdentity();
    const c = clientHello();
    const hello = codec.clientHello.fromJSON(
      JSON.parse(JSON.stringify(codec.clientHello.toJSON(c.hello))),
    );
    const s = serverRespond(hello, identity);
    const sh = codec.serverHello.fromJSON(
      JSON.parse(JSON.stringify(codec.serverHello.toJSON(s.serverHello))),
    );
    const f = clientFinish(c.state, sh, identity.publicKey);
    const fin = codec.clientFinish.fromJSON(
      JSON.parse(JSON.stringify(codec.clientFinish.toJSON(f.finish))),
    );
    const server = serverComplete(s.pending, fin);
    expect(server.open(decodeMessage(encodeMessage(f.session.seal(msg))))).toEqual(msg);
  });

  it("rejects a server hello signed by the wrong identity", () => {
    const identity = createIdentity();
    const c = clientHello();
    const s = serverRespond(c.hello, createIdentity());
    expectReason(() => clientFinish(c.state, s.serverHello, identity.publicKey), "signature");
  });

  it("rejects a tampered server hello (flipped byte in the ML-KEM key)", () => {
    const identity = createIdentity();
    const c = clientHello();
    const s = serverRespond(c.hello, identity);
    const kemPublicKey = s.serverHello.kemPublicKey.slice();
    kemPublicKey[10]! ^= 1;
    expectReason(
      () => clientFinish(c.state, { ...s.serverHello, kemPublicKey }, identity.publicKey),
      "signature",
    );
  });

  it("rejects a tampered client finish (key confirmation)", () => {
    const identity = createIdentity();
    const c = clientHello();
    const s = serverRespond(c.hello, identity);
    const f = clientFinish(c.state, s.serverHello, identity.publicKey);
    const kemCiphertext = f.finish.kemCiphertext.slice();
    kemCiphertext[5]! ^= 1;
    expectReason(() => serverComplete(s.pending, { ...f.finish, kemCiphertext }), "confirm");
  });

  it("rejects a message with one flipped byte", () => {
    const { client, server } = handshake();
    const m = client.seal(msg);
    m.ciphertext[3]! ^= 0x80;
    expectReason(() => server.open(m), "auth");
  });

  it("rejects replayed messages but accepts out-of-order ones within the window", () => {
    const { client, server } = handshake();
    const a = client.seal(msg);
    const b = client.seal(msg);
    expect(server.open(b)).toEqual(msg);
    expect(server.open(a)).toEqual(msg);
    expectReason(() => server.open(a), "replay");
    expectReason(() => server.open(b), "replay");
  });

  it("rotates keys every N messages and the receiver follows", () => {
    const { client, server } = handshake("standard", { rotateEvery: 3 });
    const epochs: number[] = [];
    for (let i = 0; i < 10; i++) {
      const m = client.seal(msg);
      epochs.push(m.epoch);
      expect(server.open(m)).toEqual(msg);
    }
    expect(epochs).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2, 3]);
    expect(server.stats.rotations).toBe(3);
  });

  it("rotates keys after T milliseconds", () => {
    let now = 0;
    const { client, server } = handshake("standard", { rotateAfterMs: 1000, now: () => now });
    expect(client.seal(msg).epoch).toBe(0);
    now = 1500;
    const m = client.seal(msg);
    expect(m.epoch).toBe(1);
    expect(server.open(m)).toEqual(msg);
  });

  it("forward secrecy: an old epoch's message isn't accepted after two rotations", () => {
    const { client, server } = handshake("standard", { rotateEvery: 1 });
    const old = client.seal(msg); // epoch 0
    server.open(client.seal(msg)); // epoch 1
    server.open(client.seal(msg)); // epoch 2
    expectReason(() => server.open(old), "epoch");
  });
});
