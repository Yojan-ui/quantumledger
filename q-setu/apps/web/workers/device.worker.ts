/// <reference lib="webworker" />
/**
 * "Seal something on this device": real post-quantum work in this browser, timed, off the main
 * thread. Browsers coarsen performance.now(), so each timing is a batch of BATCH operations divided
 * by BATCH; five batches each, medians reported:
 *  - an ML-KEM-768 handshake (FIPS 203): key generation, encapsulation, decapsulation;
 *  - sealing a short message to a hybrid X25519 + ML-KEM-768 key (AES-256-GCM), and opening it.
 * Only timings and sizes leave the worker; nothing about the device or the user.
 */
import { getKem, open, seal, utf8ToBytes } from "@qsetu/core";

const RUNS = 5;
const BATCH = 20;
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;

self.onmessage = (e: MessageEvent<{ rid: number; op: "run" }>) => {
  try {
    const kem = getKem("ml-kem-768");
    const hybrid = getKem("hybrid-x25519-mlkem768");
    const keygen: number[] = [];
    const encaps: number[] = [];
    const decaps: number[] = [];
    const sealT: number[] = [];
    const openT: number[] = [];
    let ctBytes = 0;
    let envBytes = 0;
    const msg = utf8ToBytes("sealed on this device, post-quantum");
    for (let i = 0; i < RUNS; i++) {
      // Key generation.
      let t = performance.now();
      let kp = kem.keygen();
      for (let j = 1; j < BATCH; j++) kp = kem.keygen();
      keygen.push((performance.now() - t) / BATCH);
      // Encapsulation (to the last key pair).
      t = performance.now();
      let enc = kem.encapsulate(kp.publicKey);
      for (let j = 1; j < BATCH; j++) enc = kem.encapsulate(kp.publicKey);
      encaps.push((performance.now() - t) / BATCH);
      // Decapsulation, and a check that both sides agree.
      t = performance.now();
      let ss = kem.decapsulate(enc.ciphertext, kp.secretKey);
      for (let j = 1; j < BATCH; j++) ss = kem.decapsulate(enc.ciphertext, kp.secretKey);
      decaps.push((performance.now() - t) / BATCH);
      if (ss.length !== enc.sharedSecret.length || ss.some((b, k) => b !== enc.sharedSecret[k]))
        throw new Error("ML-KEM shared secrets differ");
      ctBytes = enc.ciphertext.length;
      // Seal to a hybrid key, and open it again.
      const rk = hybrid.keygen();
      t = performance.now();
      let env = seal(msg, rk.publicKey, { profile: "standard" });
      for (let j = 1; j < BATCH; j++) env = seal(msg, rk.publicKey, { profile: "standard" });
      sealT.push((performance.now() - t) / BATCH);
      t = performance.now();
      let back = open(env, rk);
      for (let j = 1; j < BATCH; j++) back = open(env, rk);
      openT.push((performance.now() - t) / BATCH);
      if (back.length !== msg.length) throw new Error("open failed");
      envBytes = JSON.stringify(env).length;
    }
    const k = median(keygen);
    const en = median(encaps);
    const de = median(decaps);
    postMessage({
      rid: e.data.rid,
      ok: true,
      result: {
        runs: RUNS,
        batch: BATCH,
        keygenMs: k,
        encapsMs: en,
        decapsMs: de,
        handshakeMs: k + en + de,
        sealMs: median(sealT),
        openMs: median(openT),
        ciphertextBytes: ctBytes,
        envelopeBytes: envBytes,
      },
    });
  } catch (err) {
    postMessage({ rid: e.data.rid, ok: false, error: (err as Error).message });
  }
};
