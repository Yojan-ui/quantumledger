/**
 * The adversary: records everything ("harvest now"), then attacks it at Q-Day ("decrypt later").
 *
 * - Classical: really factors each tiny RSA modulus with Pollard's rho (standing in for Shor),
 *   then decrypts. `breakClassical` is isomorphic, so the browser can run it live.
 * - Q-Setu: given ephemeral X25519 secrets from a *simulated* Shor oracle, it runs the real Q-Setu
 *   key schedule with its best ML-KEM guess, and the AES-256-GCM tag check fails.
 */
import { x25519 } from "@noble/curves/ed25519.js";
import { bytesToHex, bytesToUtf8, codec, getKem, sessionFromSecrets } from "@qsetu/core";
import { classicalOpenWithD, modInverse, pollardRho, TINY_RSA_BITS } from "./classical";
import type { ShorEscrow } from "./links";
import type { HarvestRecord, QDayOutcome, RecordedHandshake } from "./types";

export class Adversary {
  private readonly records: HarvestRecord[] = [];
  private readonly handshakes = new Map<string, RecordedHandshake>();

  constructor(private readonly max = 300) {}

  harvest(r: HarvestRecord): void {
    this.records.push(r);
    if (this.records.length > this.max) this.records.shift();
  }

  harvestHandshake(h: RecordedHandshake): void {
    this.handshakes.set(h.linkId, h);
  }

  list(): HarvestRecord[] {
    return [...this.records];
  }

  clear(): void {
    this.records.length = 0;
  }

  attackQsetu(escrow: ShorEscrow): QDayOutcome[] {
    return this.records
      .filter((r) => r.mode === "qsetu")
      .map((r) => attackQsetuRecord(r, this.handshakes.get(r.qsetu!.linkId), escrow));
  }
}

const round = (ms: number) => Math.round(ms * 100) / 100;

/** Factor each modulus once, then decrypt every record. Runs in Node or in the browser. */
export function breakClassical(
  records: HarvestRecord[],
  onProgress?: (o: QDayOutcome) => void,
): QDayOutcome[] {
  const keys = new Map<string, { d: bigint; steps: number; ms: number }>();
  return records
    .filter((r) => r.mode === "classical" && r.classical)
    .map((r) => {
      const t0 = performance.now();
      const w = r.classical!;
      const log = [`n = 0x${w.modulus} (${TINY_RSA_BITS}-bit stand-in for RSA-2048)`];
      let k = keys.get(w.modulus);
      if (!k) {
        const t = performance.now();
        const { p, q, iterations } = pollardRho(BigInt(`0x${w.modulus}`));
        k = {
          d: modInverse(BigInt(`0x${w.exponent}`), (p - 1n) * (q - 1n)),
          steps: iterations,
          ms: round(performance.now() - t),
        };
        keys.set(w.modulus, k);
        log.push(
          `Factored n in ${k.steps} steps (${k.ms} ms): Pollard's rho, standing in for Shor`,
        );
      } else {
        log.push("Key already broken, so the factorisation is reused");
      }
      let out: QDayOutcome;
      try {
        const plaintext = JSON.parse(bytesToUtf8(classicalOpenWithD(w, k.d))) as Record<
          string,
          string
        >;
        log.push("Private key derived → AES key unwrapped → record decrypted");
        out = {
          recordId: r.recordId,
          harvestId: r.id,
          mode: "classical",
          status: "decrypted",
          plaintext,
          log,
          ms: round(performance.now() - t0),
        };
      } catch {
        out = {
          recordId: r.recordId,
          harvestId: r.id,
          mode: "classical",
          status: "sealed",
          log: [...log, "Decryption failed"],
          ms: round(performance.now() - t0),
        };
      }
      onProgress?.(out);
      return out;
    });
}

export function attackQsetuRecord(
  r: HarvestRecord,
  hs: RecordedHandshake | undefined,
  escrow: ShorEscrow,
): QDayOutcome {
  const t0 = performance.now();
  const base = { recordId: r.recordId, harvestId: r.id, mode: "qsetu" as const };
  if (!hs) return { ...base, status: "sealed", log: ["Handshake not captured"], ms: 0 };
  const ch = codec.clientHello.fromJSON(hs.clientHello);
  const sh = codec.serverHello.fromJSON(hs.serverHello);
  const fin = codec.clientFinish.fromJSON(hs.clientFinish);
  const log = ["Recorded handshake: X25519 shares, ML-KEM-768 public key and ciphertext"];

  const skX = escrow.get(bytesToHex(ch.x25519));
  if (!skX) return { ...base, status: "sealed", log: [...log, "No oracle output"], ms: 0 };
  const ssX = x25519.getSharedSecret(skX, sh.x25519);
  log.push("X25519 secret recovered by the simulated Shor oracle ✓");

  // Best available guess for the ML-KEM share: decapsulate under a well-formed key we control.
  const guessKey = getKem("ml-kem-768").keygen();
  const ssGuess = getKem("ml-kem-768").decapsulate(fin.kemCiphertext, guessKey.secretKey);
  log.push("ML-KEM-768 share: no known quantum attack on Module-LWE ✗");

  const { session } = sessionFromSecrets(ch, sh, fin.kemCiphertext, ssX, ssGuess, "server");
  try {
    const pt = session.open(codec.message.fromJSON(r.qsetu!.message));
    return {
      ...base,
      status: "decrypted",
      plaintext: JSON.parse(bytesToUtf8(pt)).record,
      log,
      ms: round(performance.now() - t0),
    };
  } catch {
    log.push("Derived the session key with the real key schedule → AES-256-GCM tag check failed");
    log.push("Record remains sealed");
    return { ...base, status: "sealed", log, ms: round(performance.now() - t0) };
  }
}
