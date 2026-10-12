/// <reference lib="webworker" />
/**
 * Browser-side crypto for the Web shield, SDK and certificate demos, off the main thread: seal a
 * body for the server, verify its signed reply, run an SDK session, and the forger's ML-DSA signature.
 * Everything in and out is public (bodies, nonces, public keys, signatures); the forger's throwaway
 * secret key is created and discarded here.
 */
import { bytesToBase64, getSig, utf8ToBytes } from "@qsetu/core";
import { createSession } from "@qsetu/sdk";
import { sealBody, verifyResponse, type ServerPublicKeys } from "@qsetu/web-shield";

type In =
  | { rid: number; op: "seal"; plain: Uint8Array; contentType: string; keys: ServerPublicKeys }
  | {
      rid: number;
      op: "verify";
      body: Uint8Array;
      signature: string | null;
      nonce: Uint8Array;
      keys: ServerPublicKeys;
    }
  | { rid: number; op: "forge"; message: string }
  | { rid: number; op: "sdk"; sample: unknown };

/** Demo 2's SDK adapter: a real session with /api/sdk, one request, then 200 timed seals. */
async function sdk(sample: unknown) {
  const { publicKey } = await (await fetch("/api/sdk/identity")).json();
  const s = await createSession({ url: "/api/sdk", serverKey: publicKey });
  const reply = await s.send<{ status: string; epoch: number }>(
    sample as Parameters<typeof s.send>[0],
  );
  const payload = new TextEncoder().encode(JSON.stringify(sample));
  const t = performance.now();
  for (let i = 0; i < 200; i++) s.session.seal(payload);
  const perMsg = ((performance.now() - t) / 200) * 1000;
  const wire = s.session.seal(payload);
  return {
    id: s.id,
    reply,
    handshake: s.handshake,
    perMsg,
    plainBytes: payload.length,
    wire: { epoch: wire.epoch, seq: wire.seq, head: wire.ciphertext.slice(0, 96) },
  };
}

function handle(m: In): unknown {
  if (m.op === "sdk") return sdk(m.sample);
  if (m.op === "seal") return sealBody(m.plain, m.contentType, m.keys);
  if (m.op === "verify") {
    const t = performance.now();
    const ok = verifyResponse(m.body, m.signature, m.nonce, m.keys);
    return { ok, ms: performance.now() - t };
  }
  const attacker = getSig("ml-dsa-65").keygen();
  return bytesToBase64(getSig("ml-dsa-65").sign(utf8ToBytes(m.message), attacker.secretKey));
}

self.onmessage = (e: MessageEvent<In>) => {
  try {
    void Promise.resolve(handle(e.data)).then(
      (result) => postMessage({ rid: e.data.rid, ok: true, result }),
      (err: Error) => postMessage({ rid: e.data.rid, ok: false, error: err.message }),
    );
  } catch (err) {
    postMessage({ rid: e.data.rid, ok: false, error: (err as Error).message });
  }
};
