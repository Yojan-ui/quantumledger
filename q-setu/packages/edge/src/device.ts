/**
 * QuantumLedger Edge device: the `edge` profile (X25519 + ML-KEM-512, FIPS 203; ML-DSA-44, FIPS 204).
 * One handshake, then many small AES-256-GCM readings. Every `batchSize` readings the device signs
 * a SHA-256 hash chain over the batch with ML-DSA-44, which gives origin proof without paying
 * 2.4 KB and a signature per reading.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import {
  base64ToBytes,
  bytesToBase64,
  clientFinish,
  clientHello,
  codec,
  concatBytes,
  getProfile,
  getSig,
  handshakeBytes,
  MESSAGE_OVERHEAD_BYTES,
  utf8ToBytes,
  type ClientFinishJSON,
  type ClientHelloJSON,
  type ClientState,
  type KeyPair,
  type ServerHelloJSON,
  type Session,
  type SessionMessageJSON,
} from "@qsetu/core";
import { BudgetMeter, type Budget } from "./budget";

const PROFILE = getProfile("edge");
const KEM = { pk: 800, ct: 768 };
const SIG = getSig(PROFILE.sig);

export interface Reading {
  t: number;
  v: number;
  u: string;
}

export interface BatchProof {
  deviceId: string;
  from: number;
  to: number;
  chain: string;
  sig: string;
}

export interface DeviceStats {
  ramUsed: number;
  ramPeak: number;
  ramBudget: number;
  cpuMs: number;
  simulatedMs: number;
  /** CPU spent on the handshake alone (real, not throttled). */
  handshakeCpuMs: number;
  handshakeBytes: number;
  readings: number;
  bytesPerReading: number;
  overheadPerReading: number;
  batchesSigned: number;
}

export class EdgeDevice {
  readonly meter: BudgetMeter;
  private state?: ClientState;
  private session?: Session;
  private chain: Uint8Array = new Uint8Array(32);
  private batchStart = 0;
  private count = 0;
  private hsBytes = 0;
  private lastWire = 0;
  private lastPlain = 0;
  private batches = 0;
  private handshakeCpu = 0;

  constructor(
    readonly deviceId: string,
    private readonly identity: KeyPair,
    private readonly gatewayKey: Uint8Array,
    budget: Budget,
    private readonly batchSize = 16,
  ) {
    this.meter = new BudgetMeter(budget);
    // Long-lived state: the device's own ML-DSA-44 key and the pinned gateway key.
    this.meter.hold("device-identity", identity.secretKey.length + identity.publicKey.length);
    this.meter.hold("gateway-key", gatewayKey.length);
  }

  hello(): ClientHelloJSON {
    const { hello, state } = this.meter.run(() => clientHello("edge"));
    this.state = state;
    this.meter.hold("handshake", 32 + 32 + 32);
    this.hsBytes += handshakeBytes.clientHello(hello);
    return codec.clientHello.toJSON(hello);
  }

  finish(shJSON: ServerHelloJSON): ClientFinishJSON {
    if (!this.state) throw new Error("hello() first");
    const sh = codec.serverHello.fromJSON(shJSON);
    // Peak handshake memory: the received ML-KEM public key, our ciphertext and the signature.
    this.meter.hold("handshake", 96 + KEM.pk + KEM.ct + SIG.sizes.output);
    const { finish, session } = this.meter.run(() =>
      clientFinish(this.state!, sh, this.gatewayKey, { rotateEvery: 256 }),
    );
    this.session = session;
    this.state = undefined;
    this.meter.release("handshake");
    // Steady state: two direction keys, counters and a 64-entry replay window.
    this.meter.hold("session", 32 * 2 + 16 + 8 * 4 + 64 * 8);
    this.hsBytes += handshakeBytes.serverHello(sh) + handshakeBytes.clientFinish(finish);
    this.handshakeCpu = this.meter.cpuMs;
    return codec.clientFinish.toJSON(finish);
  }

  /** Seal one reading. Returns a batch proof too when the batch closes. */
  reading(r: Reading): { message: SessionMessageJSON; proof?: BatchProof } {
    if (!this.session) throw new Error("No session");
    const plain = utf8ToBytes(JSON.stringify(r));
    this.meter.hold("reading-buffer", plain.length + MESSAGE_OVERHEAD_BYTES);
    const msg = this.meter.run(() => this.session!.seal(plain));
    this.chain = this.meter.run(() => sha256(concatBytes(this.chain, msg.ciphertext)));
    this.meter.release("reading-buffer");
    this.count++;
    this.lastPlain = plain.length;
    this.lastWire = plain.length + MESSAGE_OVERHEAD_BYTES;
    let proof: BatchProof | undefined;
    if (this.count - this.batchStart === this.batchSize) {
      this.meter.hold("signature", SIG.sizes.output);
      const sig = this.meter.run(() =>
        SIG.sign(
          batchSigned(this.deviceId, this.batchStart, this.count - 1, this.chain),
          this.identity.secretKey,
        ),
      );
      proof = {
        deviceId: this.deviceId,
        from: this.batchStart,
        to: this.count - 1,
        chain: bytesToBase64(this.chain),
        sig: bytesToBase64(sig),
      };
      this.meter.release("signature");
      this.batches++;
      this.batchStart = this.count;
      this.chain = new Uint8Array(32);
    }
    return { message: codec.message.toJSON(msg), proof };
  }

  stats(): DeviceStats {
    return {
      ramUsed: this.meter.used,
      ramPeak: this.meter.peak,
      ramBudget: this.meter.budget.ramBytes,
      cpuMs: this.meter.cpuMs,
      simulatedMs: this.meter.simulatedMs,
      handshakeCpuMs: this.handshakeCpu,
      handshakeBytes: this.hsBytes,
      readings: this.count,
      bytesPerReading: this.lastWire,
      overheadPerReading: this.lastWire - this.lastPlain,
      batchesSigned: this.batches,
    };
  }
}

export const batchSigned = (deviceId: string, from: number, to: number, chain: Uint8Array) =>
  concatBytes(utf8ToBytes(`qsetu-v1/edge-batch/${deviceId}/${from}-${to}`), chain);

export { base64ToBytes };
