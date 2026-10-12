/// <reference lib="webworker" />
/**
 * The phone's crypto, off the main thread. It generates the visitor's X25519 + ML-KEM-768 key pair
 * (FIPS 203 inside), seals messages to the room's public key and opens the room's receipts. The
 * secret key is created here and never leaves this worker: no message carries it, nothing logs it.
 */
import { sha3_256 } from "@noble/hashes/sha3.js";
import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  bytesToUtf8,
  envelopeFromJSON,
  envelopeToJSON,
  getKem,
  keyId,
  open,
  seal,
  utf8ToBytes,
  type EnvelopeJSON,
  type KeyPair,
} from "@qsetu/core";

let me: KeyPair | undefined;

export type RoomWorkerIn =
  | { rid: number; type: "keygen" }
  | { rid: number; type: "seal"; text: string; roomKey: string; visitorId: string; tamper: boolean }
  | { rid: number; type: "receipt"; receipt: EnvelopeJSON; visitorId: string; text: string };

const aad = (s: string) => utf8ToBytes(s);

self.onmessage = (e: MessageEvent<RoomWorkerIn>) => {
  const m = e.data;
  try {
    if (m.type === "keygen") {
      const t = performance.now();
      me = getKem("hybrid-x25519-mlkem768").keygen();
      postMessage({
        rid: m.rid,
        ok: true,
        publicKey: bytesToBase64(me.publicKey),
        kid: keyId(me.publicKey),
        ms: performance.now() - t,
        publicBytes: me.publicKey.length,
      });
    } else if (m.type === "seal") {
      const t = performance.now();
      const env = envelopeToJSON(
        seal(utf8ToBytes(m.text), base64ToBytes(m.roomKey), {
          aad: aad(`qsetu-room/v1|${m.visitorId}`),
        }),
      );
      const ms = performance.now() - t;
      if (m.tamper) {
        // An attacker on the path flips one bit of the ciphertext.
        const ct = base64ToBytes(env.ct);
        ct[Math.floor(ct.length / 2)]! ^= 0x01;
        env.ct = bytesToBase64(ct);
      }
      const bytes =
        base64ToBytes(env.kemCt).length +
        base64ToBytes(env.nonce).length +
        base64ToBytes(env.ct).length;
      postMessage({
        rid: m.rid,
        ok: true,
        envelope: env,
        ms,
        bytes,
        preview: bytesToHex(base64ToBytes(env.ct)).slice(0, 96),
        kemPreview: bytesToHex(base64ToBytes(env.kemCt)).slice(0, 48),
      });
    } else if (m.type === "receipt") {
      if (!me) throw new Error("No key pair yet");
      const t = performance.now();
      const plain = open(envelopeFromJSON(m.receipt), me, {
        aad: aad(`qsetu-room/v1/receipt|${m.visitorId}`),
      });
      const body = JSON.parse(bytesToUtf8(plain)) as { sha3: string; n: number };
      const mine = bytesToHex(sha3_256(utf8ToBytes(m.text)));
      postMessage({
        rid: m.rid,
        ok: true,
        matches: body.sha3 === mine,
        sha3: body.sha3,
        n: body.n,
        ms: performance.now() - t,
      });
    }
  } catch (err) {
    postMessage({ rid: m.rid, ok: false, error: (err as Error).message });
  }
};
