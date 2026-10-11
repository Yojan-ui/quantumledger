/**
 * Demo KMS. Keys are generated at startup, wrapped with AES-256-GCM under a key-encryption key (KEK)
 * and persisted through a pluggable `KeyStore`. Secret keys are never logged or returned by any API;
 * only metadata and public keys leave this module.
 *
 * The file store keeps its KEK in QSETU_KMS_KEK (64 hex chars) or, for local demos, in a 0600 file
 * beside the store. An HSM-backed store implements the same interface and does the wrapping itself.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getSig, keyId as fingerprint, type SigId } from "@qsetu/core";

export type KeyPurpose = "ledger" | "tx-signing" | "mesh-identity";

export interface StoredKey {
  id: string;
  purpose: KeyPurpose;
  alg: SigId;
  version: number;
  createdAt: number;
  retiredAt?: number;
  /** Base64 public key. */
  publicKey: string;
  /** Base64 nonce (12) ‖ ciphertext ‖ tag (16), AES-256-GCM under the KEK. */
  wrapped: string;
}

/** Where wrapped keys live. Implement this for an HSM or cloud KMS. */
export interface KeyStore {
  readonly kind: string;
  list(): StoredKey[];
  put(key: StoredKey): void;
}

export class MemoryKeyStore implements KeyStore {
  readonly kind = "memory";
  private readonly keys = new Map<string, StoredKey>();
  list() {
    return [...this.keys.values()];
  }
  put(key: StoredKey) {
    this.keys.set(key.id, { ...key });
  }
}

export class FileKeyStore implements KeyStore {
  readonly kind = "file";
  private keys: StoredKey[];
  constructor(private readonly file: string) {
    mkdirSync(dirname(file), { recursive: true });
    this.keys = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as StoredKey[]) : [];
  }
  list() {
    return this.keys.map((k) => ({ ...k }));
  }
  put(key: StoredKey) {
    this.keys = [...this.keys.filter((k) => k.id !== key.id), { ...key }];
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.keys, null, 2), { mode: 0o600 });
    renameSync(tmp, this.file);
  }
}

/** Loads the KEK from the environment, or creates a local demo KEK file (mode 0600). */
export function loadKek(dir: string): Buffer {
  const env = process.env.QSETU_KMS_KEK;
  if (env && /^[0-9a-f]{64}$/i.test(env)) return Buffer.from(env, "hex");
  const file = join(dir, "kms.kek");
  mkdirSync(dir, { recursive: true });
  if (!existsSync(file)) writeFileSync(file, randomBytes(32).toString("hex"), { mode: 0o600 });
  chmodSync(file, 0o600);
  return Buffer.from(readFileSync(file, "utf8").trim(), "hex");
}

/** A stored key without its wrapped secret: the only shape that leaves this module. */
function publicMeta(k: StoredKey): Omit<StoredKey, "wrapped"> {
  const meta: Partial<StoredKey> = { ...k };
  delete meta.wrapped;
  return meta as Omit<StoredKey, "wrapped">;
}

const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

export interface KeyEvent {
  kind: "KEYGEN" | "ROTATE";
  key: Omit<StoredKey, "wrapped">;
  ms: number;
  previous?: string;
}

export interface ActiveKey {
  meta: Omit<StoredKey, "wrapped">;
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export class KeyManager {
  /** Unwrapped secrets, held in memory only for keys that are in use. */
  private readonly cache = new Map<string, Uint8Array>();
  private readonly listeners = new Set<(e: KeyEvent) => void>();

  constructor(
    private readonly store: KeyStore,
    private readonly kek: Buffer,
    private readonly now: () => number = Date.now,
  ) {
    if (kek.length !== 32) throw new Error("KEK must be 32 bytes");
  }

  get storeKind(): string {
    return this.store.kind;
  }

  onEvent(fn: (e: KeyEvent) => void): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  /** Public metadata for every key, active and retired. Never includes secret material. */
  list(): Omit<StoredKey, "wrapped">[] {
    return this.store.list().map(publicMeta);
  }

  /** The active key for `purpose` and `alg`. Each algorithm has its own key line; creates one if needed. */
  active(purpose: KeyPurpose, alg: SigId): ActiveKey {
    const current = this.current(purpose, alg);
    return this.open(current ?? this.generate(purpose, alg));
  }

  /** Retires every active key for `purpose` and generates successors with the same algorithms. */
  rotate(purpose: KeyPurpose): ActiveKey | undefined {
    let last: ActiveKey | undefined;
    for (const k of this.store.list().filter((x) => x.purpose === purpose && !x.retiredAt))
      last = this.open(this.generate(purpose, k.alg, k));
    return last;
  }

  /** A key's public half by ID (retired keys stay verifiable). */
  publicKey(id: string): { alg: SigId; publicKey: Uint8Array } | undefined {
    const k = this.store.list().find((x) => x.id === id);
    return k && { alg: k.alg, publicKey: unb64(k.publicKey) };
  }

  private current(purpose: KeyPurpose, alg: SigId): StoredKey | undefined {
    return this.store
      .list()
      .filter((k) => k.purpose === purpose && k.alg === alg && !k.retiredAt)
      .sort((a, b) => b.version - a.version)[0];
  }

  private generate(purpose: KeyPurpose, alg: SigId, previous?: StoredKey): StoredKey {
    const t = performance.now();
    const kp = getSig(alg).keygen();
    const ms = performance.now() - t;
    const version = (previous?.version ?? 0) + 1;
    const id = `${purpose}/${alg}/v${version}/${fingerprint(kp.publicKey)}`;
    const key: StoredKey = {
      id,
      purpose,
      alg,
      version,
      createdAt: this.now(),
      publicKey: b64(kp.publicKey),
      wrapped: this.wrap(kp.secretKey, id, alg),
    };
    if (previous) {
      this.store.put({ ...previous, retiredAt: this.now() });
      this.cache.delete(previous.id);
    }
    this.store.put(key);
    this.cache.set(id, kp.secretKey);
    const meta = publicMeta(key);
    const ev: KeyEvent = {
      kind: previous ? "ROTATE" : "KEYGEN",
      key: meta,
      ms,
      previous: previous?.id,
    };
    this.listeners.forEach((fn) => fn(ev));
    return key;
  }

  private open(k: StoredKey): ActiveKey {
    let secretKey = this.cache.get(k.id);
    if (!secretKey) {
      secretKey = this.unwrap(k.wrapped, k.id, k.alg);
      this.cache.set(k.id, secretKey);
    }
    return { meta: publicMeta(k), publicKey: unb64(k.publicKey), secretKey };
  }

  private wrap(secret: Uint8Array, id: string, alg: string): string {
    const nonce = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", this.kek, nonce);
    c.setAAD(Buffer.from(`qsetu-kms-v1|${id}|${alg}`));
    const ct = Buffer.concat([c.update(secret), c.final()]);
    return Buffer.concat([nonce, ct, c.getAuthTag()]).toString("base64");
  }

  private unwrap(wrapped: string, id: string, alg: string): Uint8Array {
    const buf = Buffer.from(wrapped, "base64");
    const d = createDecipheriv("aes-256-gcm", this.kek, buf.subarray(0, 12));
    d.setAAD(Buffer.from(`qsetu-kms-v1|${id}|${alg}`));
    d.setAuthTag(buf.subarray(buf.length - 16));
    return new Uint8Array(Buffer.concat([d.update(buf.subarray(12, buf.length - 16)), d.final()]));
  }
}
