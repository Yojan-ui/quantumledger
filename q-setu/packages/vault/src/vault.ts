/**
 * Q-Setu Vault: envelope encryption for data at rest. Each record gets a random AES-256-GCM data
 * key (SP 800-38D), wrapped under a hybrid ML-KEM key (FIPS 203), and is signed with ML-DSA (FIPS 204).
 *
 *   DEK  = random 32 bytes                              (one per record)
 *   ct   = AES-256-GCM(DEK, nonce, aad = id || meta)
 *   KEK  = HKDF(KEM.Encapsulate(ownerPk).ss, info = "qsetu-v1/vault-kek" || id)
 *   wrap = AES-256-GCM(KEK, wrapNonce, aad = id).Encrypt(DEK)
 *   sig  = ML-DSA.Sign(id, kemCt, wrap, nonce, ct, meta)
 *
 * Rotating the owner key re-wraps the 32-byte DEKs only; record ciphertexts never change.
 */
import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "@noble/hashes/utils.js";
import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  bytesToUtf8,
  concatBytes,
  encodeParts,
  getKem,
  getProfile,
  getSig,
  keyId,
  utf8ToBytes,
  type KeyPair,
  type ProfileId,
} from "@qsetu/core";

export interface VaultKeys {
  profile: ProfileId;
  kem: KeyPair;
  sig: KeyPair;
}

/** Exactly what the database stores. Every field is ciphertext or public metadata. */
export interface StoredRecord {
  v: 1;
  id: string;
  profile: ProfileId;
  kid: string;
  signer: string;
  meta: Record<string, string>;
  kemCt: string;
  wrapNonce: string;
  wrappedKey: string;
  nonce: string;
  ct: string;
  sig: string;
  createdAt: string;
}

export interface VaultStore {
  get(id: string): StoredRecord | undefined | Promise<StoredRecord | undefined>;
  set(id: string, rec: StoredRecord): void | Promise<void>;
  list(): StoredRecord[] | Promise<StoredRecord[]>;
}

export class VaultError extends Error {
  constructor(
    readonly reason: "not-found" | "tamper" | "key",
    message: string,
  ) {
    super(message);
    this.name = "VaultError";
  }
}

export function memoryStore(): VaultStore & { raw: Map<string, StoredRecord> } {
  const raw = new Map<string, StoredRecord>();
  return {
    raw,
    get: (id) => raw.get(id),
    set: (id, r) => void raw.set(id, r),
    list: () => [...raw.values()],
  };
}

export function generateVaultKeys(profile: ProfileId = "standard", seed?: Uint8Array): VaultKeys {
  const p = getProfile(profile);
  return { profile, kem: getKem(p.kem).keygen(seed), sig: getSig(p.sig).keygen(seed) };
}

const metaBytes = (meta: Record<string, string>) =>
  utf8ToBytes(
    JSON.stringify(
      Object.keys(meta)
        .sort()
        .map((k) => [k, meta[k]]),
    ),
  );

const kekFor = (ss: Uint8Array, id: string) =>
  hkdf(sha256, ss, undefined, concatBytes(utf8ToBytes("qsetu-v1/vault-kek"), utf8ToBytes(id)), 32);

const signedBytes = (r: Omit<StoredRecord, "sig" | "createdAt">) =>
  concatBytes(
    utf8ToBytes("qsetu-v1/vault"),
    encodeParts(
      utf8ToBytes(r.id),
      utf8ToBytes(r.profile),
      base64ToBytes(r.kemCt),
      base64ToBytes(r.wrapNonce),
      base64ToBytes(r.wrappedKey),
      base64ToBytes(r.nonce),
      base64ToBytes(r.ct),
      metaBytes(r.meta),
    ),
  );

export interface PutResult {
  id: string;
  ms: number;
  plainBytes: number;
  storedBytes: number;
}

export interface GetResult<T> {
  data: T;
  ms: number;
  signer: string;
}

export function createVault(opts: { keys: VaultKeys; store?: VaultStore }) {
  let keys = opts.keys;
  const store = opts.store ?? memoryStore();

  function wrapDek(dek: Uint8Array, id: string, k: VaultKeys) {
    const p = getProfile(k.profile);
    const { ciphertext, sharedSecret } = getKem(p.kem).encapsulate(k.kem.publicKey);
    const wrapNonce = randomBytes(12);
    const wrapped = gcm(kekFor(sharedSecret, id), wrapNonce, utf8ToBytes(id)).encrypt(dek);
    return {
      kemCt: bytesToBase64(ciphertext),
      wrapNonce: bytesToBase64(wrapNonce),
      wrappedKey: bytesToBase64(wrapped),
      kid: keyId(k.kem.publicKey),
    };
  }

  function sign(unsigned: Omit<StoredRecord, "sig" | "createdAt">, k: VaultKeys): string {
    return bytesToBase64(
      getSig(getProfile(k.profile).sig).sign(signedBytes(unsigned), k.sig.secretKey),
    );
  }

  function verifyAndUnwrap(r: StoredRecord): Uint8Array {
    if (r.signer !== keyId(keys.sig.publicKey))
      throw new VaultError("tamper", "Record signed by an unknown key");
    const { sig, createdAt: _c, ...unsigned } = r;
    if (
      !getSig(getProfile(r.profile).sig).verify(
        base64ToBytes(sig),
        signedBytes(unsigned),
        keys.sig.publicKey,
      )
    ) {
      throw new VaultError(
        "tamper",
        `${getProfile(r.profile).sig.toUpperCase()} verification failed: record ${r.id} was modified`,
      );
    }
    if (r.kid !== keyId(keys.kem.publicKey))
      throw new VaultError("key", "Record is wrapped for a different key");
    const ss = getKem(getProfile(r.profile).kem).decapsulate(
      base64ToBytes(r.kemCt),
      keys.kem.secretKey,
    );
    return gcm(kekFor(ss, r.id), base64ToBytes(r.wrapNonce), utf8ToBytes(r.id)).decrypt(
      base64ToBytes(r.wrappedKey),
    );
  }

  return {
    store,

    async put(
      data: unknown,
      o: { id?: string; meta?: Record<string, string> } = {},
    ): Promise<PutResult> {
      const t = performance.now();
      const id = o.id ?? bytesToHex(randomBytes(8));
      const meta = o.meta ?? {};
      const plain = data instanceof Uint8Array ? data : utf8ToBytes(JSON.stringify(data));
      const dek = randomBytes(32);
      const nonce = randomBytes(12);
      const ct = gcm(dek, nonce, concatBytes(utf8ToBytes(id), metaBytes(meta))).encrypt(plain);
      const unsigned = {
        v: 1 as const,
        id,
        profile: keys.profile,
        signer: keyId(keys.sig.publicKey),
        meta,
        ...wrapDek(dek, id, keys),
        nonce: bytesToBase64(nonce),
        ct: bytesToBase64(ct),
      };
      dek.fill(0);
      const rec: StoredRecord = {
        ...unsigned,
        sig: sign(unsigned, keys),
        createdAt: new Date().toISOString(),
      };
      await store.set(id, rec);
      return {
        id,
        ms: performance.now() - t,
        plainBytes: plain.length,
        storedBytes: JSON.stringify(rec).length,
      };
    },

    async get<T = unknown>(id: string): Promise<GetResult<T>> {
      const t = performance.now();
      const r = await store.get(id);
      if (!r) throw new VaultError("not-found", `No record ${id}`);
      const dek = verifyAndUnwrap(r);
      let plain: Uint8Array;
      try {
        plain = gcm(
          dek,
          base64ToBytes(r.nonce),
          concatBytes(utf8ToBytes(id), metaBytes(r.meta)),
        ).decrypt(base64ToBytes(r.ct));
      } catch {
        throw new VaultError("tamper", `AES-GCM authentication failed: record ${id} was modified`);
      } finally {
        dek.fill(0);
      }
      return {
        data: JSON.parse(bytesToUtf8(plain)) as T,
        ms: performance.now() - t,
        signer: r.signer,
      };
    },

    /** Crypto agility: move every record to new keys (or a new profile) by re-wrapping DEKs only. */
    async rotate(next: VaultKeys): Promise<number> {
      let n = 0;
      for (const r of await store.list()) {
        const dek = verifyAndUnwrap(r);
        const { sig: _s, createdAt, ...rest } = r;
        const unsigned = {
          ...rest,
          profile: next.profile,
          signer: keyId(next.sig.publicKey),
          ...wrapDek(dek, r.id, next),
        };
        dek.fill(0);
        // A profile change re-wraps under the new KEM; the record ciphertext is untouched.
        await store.set(r.id, { ...unsigned, sig: sign(unsigned, next), createdAt });
        n++;
      }
      keys = next;
      return n;
    },
  };
}

export type Vault = ReturnType<typeof createVault>;
