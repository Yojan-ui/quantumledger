/// <reference lib="webworker" />
/**
 * The preloader's real work: generate an ML-KEM-768 key pair (FIPS 203), a hybrid key for sealing,
 * and an ML-DSA-65 key pair plus one signature (FIPS 204), all timed. Only public keys leave the worker.
 */
import { getKem, getSig, keyId, utf8ToBytes } from "@qsetu/core";

self.onmessage = () => {
  const t0 = performance.now();
  const kem = getKem("ml-kem-768").keygen();
  const t1 = performance.now();
  const hybrid = getKem("hybrid-x25519-mlkem768").keygen();
  const t2 = performance.now();
  const sig = getSig("ml-dsa-65").keygen();
  const signature = getSig("ml-dsa-65").sign(utf8ToBytes("hello, Q-Setu"), sig.secretKey);
  const t3 = performance.now();
  postMessage({
    kemPublicKey: kem.publicKey,
    kid: keyId(kem.publicKey),
    hybridPublicKey: hybrid.publicKey,
    timings: { mlkem: t1 - t0, hybrid: t2 - t1, mldsa: t3 - t2 },
    signatureBytes: signature.length,
  });
};
