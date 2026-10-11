/**
 * INSECURE_DEMO_ONLY: textbook RSA with a ~40-bit modulus, built so it can be factored in
 * milliseconds. It stands in for today's RSA-2048, which a large quantum computer running
 * Shor's algorithm would factor the same way. Never use this for anything real.
 *
 * Proper OAEP padding needs at least 2·hLen+2 bytes of modulus (66 bytes for SHA-256) and
 * can't fit in 5 bytes. Instead each block carries one random pad byte plus three data bytes.
 */
export const INSECURE_DEMO_ONLY = true;

export interface TinyRsaPublicKey {
  n: bigint;
  e: bigint;
}

export interface TinyRsaKeyPair {
  publicKey: TinyRsaPublicKey;
  /** Private exponent. Kept in memory only; never logged or serialised. */
  d: bigint;
}

export const TINY_RSA_BITS = 40;
const E = 65537n;

export function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    base = (base * base) % mod;
    exp >>= 1n;
  }
  return result;
}

export function modInverse(a: bigint, m: bigint): bigint {
  let [oldR, r] = [a % m, m];
  let [oldS, s] = [1n, 0n];
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  if (oldR !== 1n) throw new Error("not invertible");
  return ((oldS % m) + m) % m;
}

export const gcd = (a: bigint, b: bigint): bigint => {
  while (b) [a, b] = [b, a % b];
  return a < 0n ? -a : a;
};

/** Deterministic Miller-Rabin; these bases are exact for n < 3.3·10^24. */
export function isProbablePrime(n: bigint): boolean {
  if (n < 2n) return false;
  const small = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n];
  for (const p of small) if (n % p === 0n) return n === p;
  let d = n - 1n;
  let r = 0;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    r++;
  }
  outer: for (const a of small) {
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let i = 1; i < r; i++) {
      x = (x * x) % n;
      if (x === n - 1n) continue outer;
    }
    return false;
  }
  return true;
}

function randomBits(bits: number): bigint {
  const bytes = new Uint8Array(Math.ceil(bits / 8));
  globalThis.crypto.getRandomValues(bytes);
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  return v & ((1n << BigInt(bits)) - 1n);
}

function randomPrime(bits: number): bigint {
  for (;;) {
    // Force the top two bits so p·q has exactly 2·bits bits; force odd.
    const c = randomBits(bits) | (3n << BigInt(bits - 2)) | 1n;
    if (isProbablePrime(c) && gcd(c - 1n, E) === 1n) return c;
  }
}

export function tinyRsaKeygen(bits = TINY_RSA_BITS): TinyRsaKeyPair {
  for (;;) {
    const p = randomPrime(bits / 2);
    const q = randomPrime(bits / 2);
    if (p === q) continue;
    const n = p * q;
    const d = modInverse(E, (p - 1n) * (q - 1n));
    return { publicKey: { n, e: E }, d };
  }
}

/** Splits bytes into 3-byte chunks, each prefixed with a random pad byte → 32-bit blocks < n. */
export function tinyRsaEncrypt(pk: TinyRsaPublicKey, data: Uint8Array): bigint[] {
  const blocks: bigint[] = [];
  for (let i = 0; i < data.length; i += 3) {
    const chunk = data.subarray(i, i + 3);
    const pad = globalThis.crypto.getRandomValues(new Uint8Array(1))[0]!;
    let m = BigInt(pad);
    for (let j = 0; j < 3; j++) m = (m << 8n) | BigInt(chunk[j] ?? 0);
    blocks.push(modPow(m, pk.e, pk.n));
  }
  return blocks;
}

export function tinyRsaDecrypt(n: bigint, d: bigint, blocks: bigint[], length: number): Uint8Array {
  const out = new Uint8Array(blocks.length * 3);
  blocks.forEach((c, i) => {
    const m = modPow(c, d, n);
    out[i * 3] = Number((m >> 16n) & 0xffn);
    out[i * 3 + 1] = Number((m >> 8n) & 0xffn);
    out[i * 3 + 2] = Number(m & 0xffn);
  });
  return out.subarray(0, length);
}
