/**
 * Q-Setu Edge gateway: answers device handshakes with an ML-DSA-44 identity (FIPS 204), opens
 * AES-256-GCM readings, and checks each batch's hash chain and signature.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import {
  base64ToBytes,
  bytesToUtf8,
  codec,
  concatBytes,
  createIdentity,
  equalBytes,
  getSig,
  serverComplete,
  serverRespond,
  type ClientFinishJSON,
  type ClientHelloJSON,
  type Identity,
  type ServerHelloJSON,
  type ServerPending,
  type Session,
  type SessionMessageJSON,
} from "@qsetu/core";
import { batchSigned, type BatchProof, type Reading } from "./device";

export class EdgeGateway {
  readonly identity: Identity;
  private pending?: ServerPending;
  private session?: Session;
  private chain: Uint8Array = new Uint8Array(32);
  readonly accepted: Reading[] = [];
  readonly verifiedBatches: BatchProof[] = [];

  constructor(
    private readonly deviceKeys: Map<string, Uint8Array>,
    identity?: Identity,
  ) {
    this.identity = identity ?? createIdentity("edge");
  }

  hello(h: ClientHelloJSON): ServerHelloJSON {
    const { serverHello, pending } = serverRespond(codec.clientHello.fromJSON(h), this.identity);
    this.pending = pending;
    return codec.serverHello.toJSON(serverHello);
  }

  finish(f: ClientFinishJSON): void {
    if (!this.pending) throw new Error("No pending handshake");
    this.session = serverComplete(this.pending, codec.clientFinish.fromJSON(f), {
      rotateEvery: 256,
    });
    this.pending = undefined;
  }

  reading(m: SessionMessageJSON): Reading {
    if (!this.session) throw new Error("No session");
    const msg = codec.message.fromJSON(m);
    const r = JSON.parse(bytesToUtf8(this.session.open(msg))) as Reading;
    this.chain = sha256(concatBytes(this.chain, msg.ciphertext));
    this.accepted.push(r);
    return r;
  }

  /** Checks that the batch signature covers exactly the readings we received. */
  verifyBatch(p: BatchProof): boolean {
    const pk = this.deviceKeys.get(p.deviceId);
    const ok =
      !!pk &&
      equalBytes(this.chain, base64ToBytes(p.chain)) &&
      getSig("ml-dsa-44").verify(
        base64ToBytes(p.sig),
        batchSigned(p.deviceId, p.from, p.to, this.chain),
        pk,
      );
    if (ok) this.verifiedBatches.push(p);
    this.chain = new Uint8Array(32);
    return ok;
  }
}
