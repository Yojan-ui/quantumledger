/**
 * Shared types for the Q-Setu crypto SDK. Every algorithm, classical or post-quantum,
 * implements one of two interfaces (KEM or signature) so call sites never depend on a
 * concrete primitive. That is the core of crypto agility.
 */

export type Bytes = Uint8Array;

export interface KeyPair {
  publicKey: Bytes;
  secretKey: Bytes;
}

/** NIST PQC security category (1, 3, 5). 0 means "broken by a quantum adversary". */
export type NistLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface AlgorithmMeta {
  id: string;
  name: string;
  /** Standard the implementation follows, e.g. "FIPS 203". */
  standard: string;
  nistLevel: NistLevel;
  quantumSafe: boolean;
  sizes: {
    publicKey: number;
    secretKey: number;
    /** KEM ciphertext or signature length, in bytes. */
    output: number;
  };
}

export interface Encapsulation {
  ciphertext: Bytes;
  sharedSecret: Bytes;
}

export interface KemComponent {
  id: string;
  ciphertextBytes: number;
}

export interface KemAlgorithm extends AlgorithmMeta {
  kind: "kem";
  /** For hybrid KEMs: how the ciphertext splits into component ciphertexts. */
  components: readonly KemComponent[];
  /** Pass a seed (≥ 32 bytes) for deterministic keys. */
  keygen(seed?: Bytes): KeyPair;
  encapsulate(publicKey: Bytes): Encapsulation;
  decapsulate(ciphertext: Bytes, secretKey: Bytes): Bytes;
}

export interface SignatureAlgorithm extends AlgorithmMeta {
  kind: "sig";
  keygen(seed?: Bytes): KeyPair;
  sign(message: Bytes, secretKey: Bytes): Bytes;
  verify(signature: Bytes, message: Bytes, publicKey: Bytes): boolean;
}
