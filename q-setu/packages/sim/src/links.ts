/**
 * One link between two nodes, in both modes.
 * - Classical (INSECURE_DEMO_ONLY): tiny-RSA key transport + AES-256-GCM + ECDSA P-256.
 * - QuantumLedger: a real session (hybrid X25519 + ML-KEM-768, ML-DSA-65-authenticated), plus an
 *   ML-DSA-65 signature on every record by its originator.
 */
import { p256 } from "@noble/curves/nist.js";
import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  bytesToUtf8,
  clientFinish,
  clientHello,
  codec,
  createIdentity,
  getSig,
  serverComplete,
  serverRespond,
  utf8ToBytes,
  type KeyPair,
  type Session,
} from "@qsetu/core";
import {
  classicalOpen,
  classicalSeal,
  classicalVerify,
  classicalWireSize,
  tinyRsaKeygen,
  type ClassicalWire,
  type TinyRsaKeyPair,
} from "./classical";
import type { RecordedHandshake } from "./types";

export interface Node {
  name: string;
  rsa: TinyRsaKeyPair;
  ecdsa: KeyPair;
  mldsa: KeyPair;
}

export function makeNode(name: string): Node {
  return { name, rsa: tinyRsaKeygen(), ecdsa: p256.keygen(), mldsa: getSig("ml-dsa-65").keygen() };
}

/**
 * SIMULATION ONLY: the ephemeral X25519 secrets a future quantum computer could recover with
 * Shor's algorithm. The simulator keeps a copy purely so the Q-Day demo can hand them to the
 * attacker. Real endpoints erase them right after the handshake (and so do ours).
 */
export type ShorEscrow = Map<string, Uint8Array>;

export class QsetuLink {
  readonly id: string;
  readonly handshake: RecordedHandshake;
  private readonly client: Session;
  private readonly server: Session;

  constructor(
    readonly from: Node,
    readonly to: Node,
    escrow: ShorEscrow,
  ) {
    const identity = createIdentity("standard");
    const c = clientHello("standard");
    escrow.set(bytesToHex(c.hello.x25519), c.state.x25519Secret.slice());
    const s = serverRespond(c.hello, identity);
    const f = clientFinish(c.state, s.serverHello, identity.publicKey);
    this.client = f.session;
    this.server = serverComplete(s.pending, f.finish);
    this.id = this.client.id;
    this.handshake = {
      linkId: this.id,
      clientHello: codec.clientHello.toJSON(c.hello),
      serverHello: codec.serverHello.toJSON(s.serverHello),
      clientFinish: codec.clientFinish.toJSON(f.finish),
    };
  }

  send(record: Record<string, string>) {
    const body = utf8ToBytes(JSON.stringify(record));
    const sig = bytesToBase64(getSig("ml-dsa-65").sign(body, this.from.mldsa.secretKey));
    return codec.message.toJSON(this.client.seal(utf8ToBytes(JSON.stringify({ record, sig }))));
  }

  receive(m: ReturnType<QsetuLink["send"]>): {
    record: Record<string, string>;
    signatureValid: boolean;
  } {
    const { record, sig } = JSON.parse(
      bytesToUtf8(this.server.open(codec.message.fromJSON(m))),
    ) as { record: Record<string, string>; sig: string };
    const signatureValid = getSig("ml-dsa-65").verify(
      base64ToBytes(sig),
      utf8ToBytes(JSON.stringify(record)),
      this.from.mldsa.publicKey,
    );
    return { record, signatureValid };
  }
}

export class ClassicalLink {
  constructor(
    readonly from: Node,
    readonly to: Node,
  ) {}

  send(record: Record<string, string>): ClassicalWire {
    return classicalSeal(
      utf8ToBytes(JSON.stringify(record)),
      this.to.rsa.publicKey,
      this.from.ecdsa.secretKey,
    );
  }

  receive(w: ClassicalWire): { record: Record<string, string>; signatureValid: boolean } {
    const signatureValid = classicalVerify(w, this.from.ecdsa.publicKey);
    return {
      record: JSON.parse(bytesToUtf8(classicalOpen(w, this.to.rsa))) as Record<string, string>,
      signatureValid,
    };
  }

  static size = classicalWireSize;
}
