/** JSON-safe shapes shared by the simulator, the API routes and the UI. */
import type {
  ClientFinishJSON,
  ClientHelloJSON,
  ServerHelloJSON,
  SessionMessageJSON,
} from "@qsetu/core";
import type { ClassicalWire } from "./classical";
import type { SectorId } from "./sectors";

export type Mode = "classical" | "qsetu";
export type HopId = "ab" | "bc";
export type NodeId = "a" | "b" | "c";
export type Stage = "created" | "sent" | "verified" | "delivered" | "rejected";

export interface PacketView {
  id: string;
  recordId: string;
  sector: SectorId;
  mode: Mode;
  hop: HopId;
  algLabel: string;
  bytes: number;
  preview: string;
  signatureAlg: string;
  signatureStatus: "pending" | "valid" | "invalid";
  /** Measured time of the crypto for this step (seal + sign when sent; open + verify on arrival). */
  cryptoMs?: number;
}

export interface NetEvent {
  seq: number;
  at: string;
  sector: SectorId;
  recordId: string;
  mode: Mode;
  stage: Stage;
  node: NodeId;
  hop?: HopId;
  packet?: PacketView;
  message: string;
}

export interface QsetuWire {
  linkId: string;
  message: SessionMessageJSON;
}

export interface HarvestRecord {
  id: string;
  sector: SectorId;
  recordId: string;
  mode: Mode;
  hop: HopId;
  capturedAt: string;
  bytes: number;
  preview: string;
  classical?: ClassicalWire;
  qsetu?: QsetuWire;
}

/** A recorded Q-Setu handshake: everything that crossed the wire, no secrets. */
export interface RecordedHandshake {
  linkId: string;
  clientHello: ClientHelloJSON;
  serverHello: ServerHelloJSON;
  clientFinish: ClientFinishJSON;
}

export interface QDayOutcome {
  recordId: string;
  harvestId: string;
  mode: Mode;
  status: "decrypted" | "sealed";
  plaintext?: Record<string, string>;
  log: string[];
  ms: number;
}
