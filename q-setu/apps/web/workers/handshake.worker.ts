/// <reference lib="webworker" />
/**
 * Demo 1's crypto, off the main thread. Both ends of the handshake (client and server) run here,
 * with the same @qsetu/core calls the demo always made; the page asks for one step at a time and
 * gets back only public values (key shares, public keys, ciphertexts, sizes) and measured times.
 * Secret keys, client state and sessions stay inside this worker.
 */
import { sha3_256 } from "@noble/hashes/sha3.js";
import { merkle } from "@/lib/merkle";
import {
  bytesToHex,
  concatBytes,
  clientFinish,
  clientHello,
  createIdentity,
  handshakeBytes,
  serverComplete,
  serverRespond,
  utf8ToBytes,
  type ClientState,
  type Identity,
  type ProfileId,
  type ServerHello,
  type ServerPending,
  type Session,
} from "@qsetu/core";

let identity: Identity | undefined;
let client: ClientState | undefined;
let hello: ReturnType<typeof clientHello>["hello"] | undefined;
let serverHello: ServerHello | undefined;
let pending: ServerPending | undefined;
let clientSession: Session | undefined;
let serverSession: Session | undefined;

export type HandshakeIn =
  | { rid: number; op: "identity"; profile: ProfileId }
  | { rid: number; op: "hello"; profile: ProfileId }
  | { rid: number; op: "respond" }
  | { rid: number; op: "finish" }
  | { rid: number; op: "messages"; n: number }
  | { rid: number; op: "attack"; profile: ProfileId }
  | { rid: number; op: "sha3"; text: string }
  | { rid: number; op: "merkle"; leaves: string[] };

function timed<T>(fn: () => T): [T, number] {
  const t = performance.now();
  const r = fn();
  return [r, performance.now() - t];
}

function handle(m: HandshakeIn): unknown {
  switch (m.op) {
    case "identity": {
      identity = createIdentity(m.profile);
      client = hello = serverHello = pending = clientSession = serverSession = undefined;
      return { publicKeyBytes: identity.publicKey.length };
    }
    case "hello": {
      const [c, ms] = timed(() => clientHello(m.profile));
      client = c.state;
      hello = c.hello;
      return { x25519: c.hello.x25519, bytes: handshakeBytes.clientHello(c.hello), ms };
    }
    case "respond": {
      const [s, ms] = timed(() => serverRespond(hello!, identity!));
      serverHello = s.serverHello;
      pending = s.pending;
      return {
        kemPublicKey: s.serverHello.kemPublicKey,
        kemPkBytes: s.serverHello.kemPublicKey.length,
        sigBytes: s.serverHello.signature.length,
        bytes: handshakeBytes.serverHello(s.serverHello),
        ms,
      };
    }
    case "finish": {
      const [f, tc] = timed(() => clientFinish(client!, serverHello!, identity!.publicKey));
      const [server, ts] = timed(() => serverComplete(pending!, f.finish));
      clientSession = f.session;
      serverSession = server;
      // The transcript the Proof Chain anchors: both key shares, the server's ML-KEM key and the
      // client's ciphertext, hashed (public values only).
      const transcript = concatBytes(
        hello!.x25519,
        serverHello!.kemPublicKey,
        f.finish.kemCiphertext,
      );
      return {
        transcriptSha3: bytesToHex(sha3_256(transcript)),
        sharedSecretBytes: 32,
        kemCiphertext: f.finish.kemCiphertext,
        bytes: handshakeBytes.clientFinish(f.finish),
        sessionId: server.id,
        tc,
        ts,
      };
    }
    case "messages": {
      const msgs = Array.from({ length: m.n }, (_, k) =>
        utf8ToBytes(JSON.stringify({ n: k, amountINR: (100 + k * 37).toFixed(2) })),
      );
      const t = performance.now();
      const sealed = msgs.map((x) => clientSession!.seal(x));
      const opened = sealed.map((x) => serverSession!.open(x));
      const per = ((performance.now() - t) / msgs.length) * 1000;
      return {
        per,
        opened: opened.length,
        plainBytes: msgs[0]!.length,
        // The first message's real bytes (a public demo payload), for the folding sheet.
        plain: msgs[0]!,
        cipher: sealed[0]!.ciphertext.slice(0, 64),
        openedPlain: opened[0]!,
        sealed: sealed.map((x) => ({
          seq: x.seq,
          ctBytes: x.ciphertext.length,
          head: x.ciphertext.slice(0, 24),
        })),
      };
    }
    case "merkle":
      return merkle(m.leaves);
    case "sha3":
      return bytesToHex(sha3_256(utf8ToBytes(m.text)));
    case "attack": {
      // A man-in-the-middle swaps the server's ML-KEM key for their own but can't re-sign it.
      const c = clientHello(m.profile);
      const { serverHello: sh } = serverRespond(c.hello, identity!);
      const forged = { ...sh, kemPublicKey: sh.kemPublicKey.slice() };
      forged.kemPublicKey.set(new Uint8Array(32).fill(0x66), 100);
      const t = performance.now();
      try {
        clientFinish(c.state, forged, identity!.publicKey);
        return {
          rejected: false,
          ms: performance.now() - t,
          bytes: handshakeBytes.serverHello(forged),
          tail: forged.kemPublicKey.slice(96, 128),
        };
      } catch (e) {
        return {
          rejected: true,
          error: (e as Error).message,
          ms: performance.now() - t,
          bytes: handshakeBytes.serverHello(forged),
          tail: forged.kemPublicKey.slice(96, 128),
        };
      }
    }
  }
}

self.onmessage = (e: MessageEvent<HandshakeIn>) => {
  try {
    postMessage({ rid: e.data.rid, ok: true, result: handle(e.data) });
  } catch (err) {
    postMessage({ rid: e.data.rid, ok: false, error: (err as Error).message });
  }
};
