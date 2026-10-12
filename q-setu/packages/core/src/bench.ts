/**
 * Benchmarks for FIPS 203/204/205 algorithms, sessions and envelopes: median wall-clock time of N
 * runs plus byte sizes. Includes classical baselines (RSA-2048 via WebCrypto, ECDSA P-256). Every
 * number the UI shows comes from here; nothing is hard-coded.
 */
import { gcm } from "@noble/ciphers/aes.js";
import { p256 } from "@noble/curves/nist.js";
import { randomBytes } from "@noble/hashes/utils.js";
import { utf8ToBytes } from "./encoding";
import { x25519 } from "@noble/curves/ed25519.js";
import { envelopeSize, open, seal } from "./envelope";
import { getKem, getProfile, getSig, PROFILES, registry, type ProfileId } from "./registry";
import { handshakeBytes } from "./session-codec";
import {
  clientFinish,
  clientHello,
  createIdentity,
  MESSAGE_OVERHEAD_BYTES,
  serverComplete,
  serverRespond,
} from "./session";
import type { KemAlgorithm, SignatureAlgorithm } from "./types";

export type BenchKind = "kem" | "sig" | "envelope";

export interface BenchRow {
  id: string;
  name: string;
  kind: BenchKind;
  quantumSafe: boolean;
  nistLevel: number;
  baseline: boolean;
  /** Median milliseconds per operation. */
  ops: Record<string, number>;
  sizes: { publicKey: number; secretKey?: number; output: number };
}

export interface SessionBench {
  profile: ProfileId;
  /** CPU time for the full handshake, both sides combined. */
  handshakeMs: number;
  handshakeBytes: number;
  /** One 256-byte message: seal + open. */
  perMessageUs: number;
  messageOverheadBytes: number;
  /** One-shot envelope (Web / Vault): seal + open, signed. */
  envelopeMs: number;
  envelopeOverheadBytes: number;
  /** Classical baseline handshake: X25519 + ECDSA P-256 (what TLS does today). */
  classicalHandshakeMs: number;
  /** Plain AES-256-GCM on the same message: what you'd pay without QuantumLedger. */
  baselineMessageUs: number;
}

export interface BenchReport {
  generatedAt: string;
  runtime: string;
  iterations: number;
  rows: BenchRow[];
  sessions: SessionBench[];
}

const now = () => globalThis.performance.now();

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

async function time(runs: number, fn: () => unknown | Promise<unknown>): Promise<number> {
  await fn(); // warm-up
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = now();
    await fn();
    samples.push(now() - t);
  }
  return round(median(samples));
}

const round = (ms: number) => Math.round(ms * 1000) / 1000;

/** A representative UPI ReqPay-sized payload (~300 bytes of JSON). */
export const SAMPLE_PAYLOAD = utf8ToBytes(
  JSON.stringify({
    txnId: "QST2026101100000001",
    payerVPA: "ravi.kumar@bharatbank",
    payeeVPA: "anjali.menon@sahyadri",
    amountINR: "2450.00",
    timestamp: "2026-10-11T10:15:00.000Z",
    note: "Rent share October",
    device: { os: "android", app: "BharatPay 4.2.1", geo: "12.97,77.59" },
    risk: { score: 12, mcc: "6012" },
  }),
);

async function benchKem(alg: KemAlgorithm, runs: number): Promise<BenchRow> {
  const kp = alg.keygen();
  const { ciphertext } = alg.encapsulate(kp.publicKey);
  return {
    id: alg.id,
    name: alg.name,
    kind: "kem",
    quantumSafe: alg.quantumSafe,
    nistLevel: alg.nistLevel,
    baseline: false,
    ops: {
      keygen: await time(runs, () => alg.keygen()),
      encapsulate: await time(runs, () => alg.encapsulate(kp.publicKey)),
      decapsulate: await time(runs, () => alg.decapsulate(ciphertext, kp.secretKey)),
    },
    sizes: {
      publicKey: kp.publicKey.length,
      secretKey: kp.secretKey.length,
      output: ciphertext.length,
    },
  };
}

async function benchSig(alg: SignatureAlgorithm, runs: number): Promise<BenchRow> {
  const kp = alg.keygen();
  const sig = alg.sign(SAMPLE_PAYLOAD, kp.secretKey);
  return {
    id: alg.id,
    name: alg.name,
    kind: "sig",
    quantumSafe: alg.quantumSafe,
    nistLevel: alg.nistLevel,
    baseline: false,
    ops: {
      keygen: await time(runs, () => alg.keygen()),
      sign: await time(runs, () => alg.sign(SAMPLE_PAYLOAD, kp.secretKey)),
      verify: await time(runs, () => alg.verify(sig, SAMPLE_PAYLOAD, kp.publicKey)),
    },
    sizes: { publicKey: kp.publicKey.length, secretKey: kp.secretKey.length, output: sig.length },
  };
}

const RSA_PARAMS: RsaHashedKeyGenParams = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};

async function rsaKeygen(): Promise<CryptoKeyPair> {
  return globalThis.crypto.subtle.generateKey(RSA_PARAMS, true, ["encrypt", "decrypt"]);
}

async function benchRsa2048(runs: number): Promise<BenchRow> {
  const subtle = globalThis.crypto.subtle;
  const kp = await rsaKeygen();
  const secret = randomBytes(32);
  const ct = new Uint8Array(await subtle.encrypt({ name: "RSA-OAEP" }, kp.publicKey, secret));
  const spki = new Uint8Array(await subtle.exportKey("spki", kp.publicKey));
  const pkcs8 = new Uint8Array(await subtle.exportKey("pkcs8", kp.privateKey));
  return {
    id: "rsa-2048-oaep",
    name: "RSA-2048 (OAEP)",
    kind: "kem",
    quantumSafe: false,
    nistLevel: 0,
    baseline: true,
    ops: {
      // RSA keygen is slow and high-variance, so it gets fewer samples.
      keygen: await time(Math.min(runs, 5), rsaKeygen),
      encapsulate: await time(runs, () =>
        subtle.encrypt({ name: "RSA-OAEP" }, kp.publicKey, secret),
      ),
      decapsulate: await time(runs, () => subtle.decrypt({ name: "RSA-OAEP" }, kp.privateKey, ct)),
    },
    sizes: { publicKey: spki.length, secretKey: pkcs8.length, output: ct.length },
  };
}

async function benchEcdsaP256(runs: number): Promise<BenchRow> {
  const kp = p256.keygen();
  const sig = p256.sign(SAMPLE_PAYLOAD, kp.secretKey);
  return {
    id: "ecdsa-p256",
    name: "ECDSA P-256",
    kind: "sig",
    quantumSafe: false,
    nistLevel: 0,
    baseline: true,
    ops: {
      keygen: await time(runs, () => p256.keygen()),
      sign: await time(runs, () => p256.sign(SAMPLE_PAYLOAD, kp.secretKey)),
      verify: await time(runs, () => p256.verify(sig, SAMPLE_PAYLOAD, kp.publicKey)),
    },
    sizes: { publicKey: kp.publicKey.length, secretKey: kp.secretKey.length, output: sig.length },
  };
}

export const MESSAGE_SAMPLE = SAMPLE_PAYLOAD.subarray(0, 256);

/** Full handshake, then the per-message cost, for one profile. */
export async function benchSession(profileId: ProfileId, runs: number): Promise<SessionBench> {
  const profile = getProfile(profileId);
  const identity = createIdentity(profileId);
  const handshake = () => {
    const c = clientHello(profileId);
    const s = serverRespond(c.hello, identity);
    const f = clientFinish(c.state, s.serverHello, identity.publicKey);
    return { client: f.session, server: serverComplete(s.pending, f.finish), c, s, f };
  };
  const sample = handshake();
  const hsBytes =
    handshakeBytes.clientHello(sample.c.hello) +
    handshakeBytes.serverHello(sample.s.serverHello) +
    handshakeBytes.clientFinish(sample.f.finish);

  const msgRuns = runs * 20;
  const perMessage = await time(msgRuns, () =>
    sample.server.open(sample.client.seal(MESSAGE_SAMPLE)),
  );
  const key = randomBytes(32);
  const nonce = randomBytes(12);
  const baseline = await time(msgRuns, () =>
    gcm(key, nonce).decrypt(gcm(key, nonce).encrypt(MESSAGE_SAMPLE)),
  );

  const recipient = getKem(profile.kem).keygen();
  const signer = getSig(profile.sig).keygen();
  const env = seal(MESSAGE_SAMPLE, recipient.publicKey, { profile: profileId, signer });

  const ec = p256.keygen();
  const classical = () => {
    const a = x25519.keygen();
    const b = x25519.keygen();
    const sig = p256.sign(b.publicKey, ec.secretKey);
    p256.verify(sig, b.publicKey, ec.publicKey);
    x25519.getSharedSecret(a.secretKey, b.publicKey);
    x25519.getSharedSecret(b.secretKey, a.publicKey);
  };

  return {
    profile: profileId,
    handshakeMs: await time(runs, handshake),
    handshakeBytes: hsBytes,
    perMessageUs: round(perMessage * 1000),
    messageOverheadBytes: MESSAGE_OVERHEAD_BYTES,
    envelopeMs: await time(runs, () =>
      open(seal(MESSAGE_SAMPLE, recipient.publicKey, { profile: profileId, signer }), recipient, {
        senderPublicKey: signer.publicKey,
      }),
    ),
    envelopeOverheadBytes: envelopeSize(env) - MESSAGE_SAMPLE.length,
    classicalHandshakeMs: await time(runs, classical),
    baselineMessageUs: round(baseline * 1000),
  };
}

/** Today's equivalent: RSA-2048-OAEP key transport + AES-256-GCM + ECDSA P-256. */
async function benchClassicalEnvelope(runs: number): Promise<BenchRow> {
  const subtle = globalThis.crypto.subtle;
  const rsa = await rsaKeygen();
  const ec = p256.keygen();
  const sealClassical = async () => {
    const key = randomBytes(32);
    const nonce = randomBytes(12);
    const wrapped = new Uint8Array(await subtle.encrypt({ name: "RSA-OAEP" }, rsa.publicKey, key));
    const body = gcm(key, nonce).encrypt(SAMPLE_PAYLOAD);
    const sig = p256.sign(body, ec.secretKey);
    return { wrapped, nonce, body, sig };
  };
  const sample = await sealClassical();
  const openClassical = async () => {
    if (!p256.verify(sample.sig, sample.body, ec.publicKey)) throw new Error("bad sig");
    const key = new Uint8Array(
      await subtle.decrypt({ name: "RSA-OAEP" }, rsa.privateKey, sample.wrapped),
    );
    return gcm(key, sample.nonce).decrypt(sample.body);
  };
  const spki = new Uint8Array(await subtle.exportKey("spki", rsa.publicKey));
  return {
    id: "classical-envelope",
    name: "Classical envelope (RSA-2048 + ECDSA P-256)",
    kind: "envelope",
    quantumSafe: false,
    nistLevel: 0,
    baseline: true,
    ops: { seal: await time(runs, sealClassical), open: await time(runs, openClassical) },
    sizes: {
      publicKey: spki.length,
      output: sample.wrapped.length + sample.nonce.length + sample.body.length + sample.sig.length,
    },
  };
}

export async function runBench(iterations = 30): Promise<BenchReport> {
  const rows: BenchRow[] = [];
  for (const alg of Object.values(registry.kem)) rows.push(await benchKem(alg, iterations));
  rows.push(await benchRsa2048(iterations));
  for (const alg of Object.values(registry.sig)) {
    // SLH-DSA signs in tens of milliseconds, so it gets a few samples only.
    rows.push(await benchSig(alg, alg.id.startsWith("slh") ? Math.min(iterations, 3) : iterations));
  }
  rows.push(await benchEcdsaP256(iterations));
  rows.push(await benchClassicalEnvelope(iterations));
  const sessions: SessionBench[] = [];
  for (const id of Object.keys(PROFILES) as ProfileId[])
    sessions.push(await benchSession(id, iterations));
  const runtime =
    typeof process !== "undefined" && process.versions?.node
      ? `Node ${process.versions.node} (${process.platform}/${process.arch})`
      : (globalThis.navigator?.userAgent ?? "unknown");
  return { generatedAt: new Date().toISOString(), runtime, iterations, rows, sessions };
}
