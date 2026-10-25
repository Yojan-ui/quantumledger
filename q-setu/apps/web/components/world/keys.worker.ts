/// <reference lib="webworker" />
/**
 * The visitor's keys and every check the page makes, off the main thread.
 *
 * keys: the preloader's real work. An X25519 + ML-KEM-768 key pair (FIPS 203; its 1,184-byte ML-KEM
 *   public key is the hero's dot field) and an ML-DSA-65 key pair plus one signature (FIPS 204), all
 *   timed. Secret keys never leave this worker; only public keys and timings are posted back.
 * accept: the headline handshake. Decapsulates the server's ciphertext with the secret key held here.
 * unseal: verifies the bundle's ML-DSA-65 signature against the pinned site key, then decrypts one
 *   headline (AES-256-GCM). Nothing is decrypted unless the signature verifies.
 * response: checks a signed API response (SHA-384 of the body, then the ML-DSA-65 signature).
 * manifest / asset: fetches and verifies the signed asset manifest, then hashes static files
 *   against it.
 */
import { base64ToBytes, concatBytes, getKem, getSig, keyId, utf8ToBytes } from "@qsetu/core";
import { verifyManifest, type Manifest, MANIFEST_PATH } from "@qsetu/shield/manifest-format";
import {
  headlineKey,
  headlinesSignedBytes,
  MAX_SKEW_MS,
  responseSignedBytes,
  sha384,
  type SealedBundle,
} from "@/lib/trust/format";

const SITE_KEY = base64ToBytes(process.env.NEXT_PUBLIC_QSETU_SITE_KEY ?? "");
const mldsa = getSig("ml-dsa-65");

let hybrid: { publicKey: Uint8Array; secretKey: Uint8Array } | undefined;
let sealed: { bundle: SealedBundle; ss: Uint8Array; signed: Uint8Array } | undefined;
let manifest: Record<string, string> | undefined;

const timed = <T>(fn: () => T): [T, number] => {
  const t = performance.now();
  const r = fn();
  return [r, performance.now() - t];
};

export type KeysIn =
  | { rid: number; op: "keys" }
  | { rid: number; op: "accept"; bundle: SealedBundle }
  | { rid: number; op: "unseal"; id: string }
  | {
      rid: number;
      op: "response";
      method: string;
      path: string;
      body: ArrayBuffer;
      hash: string;
      ts: number;
      sig: string;
    }
  | { rid: number; op: "manifest" }
  | { rid: number; op: "asset"; path: string };

export type Check = { ok: true; ms: number } | { ok: false; ms: number; reason: string };

async function handle(m: KeysIn): Promise<unknown> {
  switch (m.op) {
    case "keys": {
      // The hybrid key is assembled from its halves so the ML-KEM-768 keygen is timed on its own;
      // the layout (pk = x25519 ‖ ml-kem, sk = x25519 ‖ ml-kem ‖ ml-kem pk) is the hybrid KEM's.
      const [kem, mlkemMs] = timed(() => getKem("ml-kem-768").keygen());
      const [x, xMs] = timed(() => getKem("x25519").keygen());
      hybrid = {
        publicKey: concatBytes(x.publicKey, kem.publicKey),
        secretKey: concatBytes(x.secretKey, kem.secretKey, kem.publicKey),
      };
      const t = performance.now();
      const sig = mldsa.keygen();
      const signature = mldsa.sign(utf8ToBytes("hello, QuantumLedger"), sig.secretKey);
      return {
        kemPublicKey: kem.publicKey,
        kid: keyId(kem.publicKey),
        hybridPublicKey: hybrid.publicKey,
        timings: { mlkem: mlkemMs, hybrid: mlkemMs + xMs, mldsa: performance.now() - t },
        signatureBytes: signature.length,
      };
    }
    case "accept": {
      if (!hybrid) throw new Error("no key pair yet");
      const b = m.bundle;
      const kemCt = base64ToBytes(b.kemCt);
      const [ss, decapsMs] = timed(() =>
        getKem("hybrid-x25519-mlkem768").decapsulate(kemCt, hybrid!.secretKey),
      );
      const items = b.items.map((i) => ({
        id: i.id,
        nonce: base64ToBytes(i.nonce),
        ct: base64ToBytes(i.ct),
      }));
      sealed = {
        bundle: b,
        ss,
        signed: headlinesSignedBytes(b.ts, hybrid.publicKey, kemCt, items),
      };
      // The ciphertext itself (hex) is what the page shows until each headline is verified.
      const hex: Record<string, string> = {};
      for (const i of items)
        hex[i.id] = Array.from(i.ct, (x) => x.toString(16).padStart(2, "0")).join("");
      return { decapsMs, hex };
    }
    case "unseal": {
      if (!sealed) throw new Error("no sealed bundle");
      const item = sealed.bundle.items.find((i) => i.id === m.id);
      if (!item) return { ok: false, reason: "not sealed" };
      // Verify first, every time: nothing is decrypted unless the site's signature checks out.
      const [ok, verifyMs] = timed(
        () =>
          sealed!.bundle.keyId === keyId(SITE_KEY) &&
          mldsa.verify(base64ToBytes(sealed!.bundle.signature), sealed!.signed, SITE_KEY),
      );
      if (!ok) return { ok: false, reason: "signature invalid", verifyMs };
      const nonce = base64ToBytes(item.nonce);
      try {
        const key = await headlineKey(sealed.ss, nonce, item.id, "decrypt");
        const pt = await crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: nonce as BufferSource,
            additionalData: utf8ToBytes(item.id) as BufferSource,
          },
          key,
          base64ToBytes(item.ct) as BufferSource,
        );
        return { ok: true, text: new TextDecoder().decode(pt), verifyMs };
      } catch {
        return { ok: false, reason: "decryption failed", verifyMs };
      }
    }
    case "response": {
      const t = performance.now();
      const got = await sha384(new Uint8Array(m.body));
      if (got !== m.hash)
        return { ok: false, reason: "hash mismatch", ms: performance.now() - t } satisfies Check;
      let sig: Uint8Array;
      try {
        sig = base64ToBytes(m.sig);
      } catch {
        return { ok: false, reason: "bad signature", ms: performance.now() - t } satisfies Check;
      }
      const good = mldsa.verify(sig, responseSignedBytes(m.method, m.path, m.ts, m.hash), SITE_KEY);
      const ms = performance.now() - t;
      if (!good) return { ok: false, reason: "signature invalid", ms } satisfies Check;
      if (Math.abs(Date.now() - m.ts) > MAX_SKEW_MS)
        return { ok: false, reason: "stale (replay?)", ms } satisfies Check;
      return { ok: true, ms } satisfies Check;
    }
    case "manifest": {
      const r = await fetch(MANIFEST_PATH, { cache: "no-store" });
      const m2 = (await r.json()) as Manifest;
      const [v, ms] = timed(() => verifyManifest(m2, SITE_KEY));
      if (!v.ok) return { ok: false, reason: `manifest ${v.reason}`, ms };
      manifest = m2.files;
      return { ok: true, ms, files: Object.keys(m2.files).length };
    }
    case "asset": {
      const want = manifest?.[m.path];
      if (!want) return { ok: false, uncovered: true, reason: "not in manifest", ms: 0 };
      const r = await fetch(m.path, { cache: "force-cache" });
      const body = new Uint8Array(await r.arrayBuffer());
      const t = performance.now();
      const got = await sha384(body);
      const ms = performance.now() - t;
      return got === want ? { ok: true, ms } : { ok: false, reason: "hash mismatch", ms };
    }
  }
}

self.onmessage = (e: MessageEvent<KeysIn>) => {
  const { rid } = e.data;
  handle(e.data).then(
    (result) => postMessage({ rid, ok: true, result }),
    (err: unknown) =>
      postMessage({ rid, ok: false, error: String((err as Error)?.message ?? err) }),
  );
};
