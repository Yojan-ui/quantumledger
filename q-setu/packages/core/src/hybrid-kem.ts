/**
 * Hybrid KEM: X25519 (RFC 7748) + ML-KEM (FIPS 203), combined with HKDF-SHA256 (RFC 5869) in
 * the "concatenate, then KDF" style of NIST SP 800-56C Rev. 2 and SP 800-227.
 *
 *   key = HKDF-SHA256(ikm  = ss_x25519 || ss_mlkem,
 *                     salt = "qsetu-v1/hybrid-salt" (or caller-supplied),
 *                     info = "qsetu-v1" || SHA-256(transcript))
 *
 * Why this stays secure if EITHER algorithm holds:
 * - HKDF-Extract is HMAC-SHA256, which is a PRF and a good randomness extractor in its message
 *   input. If either half of the IKM is uniformly random and unknown to the attacker, the
 *   extracted key is pseudorandom. A future quantum attacker who recovers ss_x25519 with Shor's
 *   algorithm still learns nothing about the output.
 * - If a classical flaw is ever found in ML-KEM (it's newer), X25519 still protects the key
 *   against classical attackers.
 * - Hashing both ciphertexts and both public keys into `info` binds the key to this exact
 *   exchange, so components can't be spliced across sessions. That matters because X25519
 *   alone isn't IND-CCA. The same idea appears in X-Wing and the TLS 1.3 hybrid design.
 */
import { x25519 as curve } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { mlKem1024, mlKem512, mlKem768 } from "./algorithms/ml-kem";
import { x25519Kem } from "./algorithms/x25519";
import { concatBytes, encodeParts, splitBytes, utf8ToBytes } from "./encoding";
import type { Bytes, KemAlgorithm } from "./types";

const INFO_PREFIX = utf8ToBytes("qsetu-v1");
const DEFAULT_SALT = utf8ToBytes("qsetu-v1/hybrid-salt");

/** The combiner, shared by the hybrid KEM and the session handshake. */
export function combineSecrets(
  ssClassical: Bytes,
  ssPostQuantum: Bytes,
  transcript: Bytes,
  salt: Bytes = DEFAULT_SALT,
): Bytes {
  return hkdf(
    sha256,
    concatBytes(ssClassical, ssPostQuantum),
    salt,
    concatBytes(INFO_PREFIX, sha256(transcript)),
    32,
  );
}

function makeHybrid(pq: KemAlgorithm, id: string, name: string): KemAlgorithm {
  const X = x25519Kem.sizes;
  const M = pq.sizes;
  const transcript = (ctX: Bytes, ctM: Bytes, pkX: Bytes, pkM: Bytes) =>
    encodeParts(ctX, ctM, pkX, pkM);
  return {
    kind: "kem",
    id,
    name,
    standard: "FIPS 203 + RFC 7748 (SP 800-56C combiner)",
    nistLevel: pq.nistLevel,
    quantumSafe: true,
    // Secret key = sk_x || sk_mlkem || pk_mlkem, so decapsulation can rebuild the transcript.
    sizes: {
      publicKey: X.publicKey + M.publicKey,
      secretKey: X.secretKey + M.secretKey + M.publicKey,
      output: X.output + M.output,
    },
    components: [
      { id: "x25519", ciphertextBytes: X.output },
      { id: pq.id, ciphertextBytes: M.output },
    ],
    keygen(seed) {
      const x = x25519Kem.keygen(seed);
      const m = pq.keygen(seed);
      return {
        publicKey: concatBytes(x.publicKey, m.publicKey),
        secretKey: concatBytes(x.secretKey, m.secretKey, m.publicKey),
      };
    },
    encapsulate(publicKey) {
      const [pkX, pkM] = splitBytes(publicKey, [X.publicKey, M.publicKey]) as [Bytes, Bytes];
      const x = x25519Kem.encapsulate(pkX);
      const m = pq.encapsulate(pkM);
      return {
        ciphertext: concatBytes(x.ciphertext, m.ciphertext),
        sharedSecret: combineSecrets(
          x.sharedSecret,
          m.sharedSecret,
          transcript(x.ciphertext, m.ciphertext, pkX, pkM),
        ),
      };
    },
    decapsulate(ciphertext, secretKey) {
      const [ctX, ctM] = splitBytes(ciphertext, [X.output, M.output]) as [Bytes, Bytes];
      const [skX, skM, pkM] = splitBytes(secretKey, [X.secretKey, M.secretKey, M.publicKey]) as [
        Bytes,
        Bytes,
        Bytes,
      ];
      const ssX = x25519Kem.decapsulate(ctX, skX);
      const ssM = pq.decapsulate(ctM, skM);
      return combineSecrets(ssX, ssM, transcript(ctX, ctM, curve.getPublicKey(skX), pkM));
    },
  };
}

export const hybridX25519MlKem768 = makeHybrid(
  mlKem768,
  "hybrid-x25519-mlkem768",
  "X25519 + ML-KEM-768",
);
export const hybridX25519MlKem512 = makeHybrid(
  mlKem512,
  "hybrid-x25519-mlkem512",
  "X25519 + ML-KEM-512",
);
export const hybridX25519MlKem1024 = makeHybrid(
  mlKem1024,
  "hybrid-x25519-mlkem1024",
  "X25519 + ML-KEM-1024",
);
