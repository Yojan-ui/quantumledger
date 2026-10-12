/**
 * A sector network: node A → node B → node C, carrying each record twice in parallel (classical
 * and QuantumLedger). An adversary taps both links of both modes.
 */
import { Adversary } from "./adversary";
import { ClassicalLink, makeNode, QsetuLink, type ShorEscrow } from "./links";
import { SECTORS, type SectorId } from "./sectors";
import type {
  HarvestRecord,
  HopId,
  Mode,
  NetEvent,
  NodeId,
  PacketView,
  QDayOutcome,
} from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const b64Preview = (b64: string) => {
  const bin = globalThis.atob(b64.slice(0, 44));
  let hex = "";
  for (let i = 0; i < bin.length; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, "0");
  return `${hex.slice(0, 56)}…`;
};

export class SectorNetwork {
  readonly adversary = new Adversary();
  private readonly escrow: ShorEscrow = new Map();
  private readonly listeners = new Set<(e: NetEvent) => void>();
  private readonly classical: Record<HopId, ClassicalLink>;
  private readonly qsetu: Record<HopId, QsetuLink>;
  private seq = 0;
  private packetSeq = 0;

  constructor(readonly sector: SectorId) {
    const [a, b, c] = SECTORS[sector].nodes.map(makeNode) as [
      ReturnType<typeof makeNode>,
      ReturnType<typeof makeNode>,
      ReturnType<typeof makeNode>,
    ];
    this.classical = { ab: new ClassicalLink(a, b), bc: new ClassicalLink(b, c) };
    this.qsetu = { ab: new QsetuLink(a, b, this.escrow), bc: new QsetuLink(b, c, this.escrow) };
    // The handshakes cross the wire too, and the adversary records them.
    this.adversary.harvestHandshake(this.qsetu.ab.handshake);
    this.adversary.harvestHandshake(this.qsetu.bc.handshake);
  }

  subscribe(fn: (e: NetEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Starts `count` records; `done` resolves when all are delivered. */
  simulate(count: number, paceMs = 900) {
    const records = Array.from({ length: count }, () => SECTORS[this.sector].generate());
    const done = Promise.all(
      records.map(async (rec, i) => {
        if (paceMs) await sleep(i * paceMs * 0.8);
        await Promise.all([this.carry(rec, "classical", paceMs), this.carry(rec, "qsetu", paceMs)]);
      }),
    ).then(() => undefined);
    return { records, done };
  }

  harvested(): HarvestRecord[] {
    return this.adversary.list();
  }

  /** Q-Day against QuantumLedger traffic (server side, since it needs the simulated Shor oracle). */
  qDayQsetu(): QDayOutcome[] {
    return this.adversary.attackQsetu(this.escrow);
  }

  reset(): void {
    this.adversary.clear();
  }

  private emit(e: Omit<NetEvent, "seq" | "at" | "sector">): void {
    const ev: NetEvent = {
      ...e,
      sector: this.sector,
      seq: ++this.seq,
      at: new Date().toISOString(),
    };
    for (const fn of this.listeners) fn(ev);
  }

  private async carry(record: Record<string, string>, mode: Mode, pace: number): Promise<void> {
    const recordId = record.recordId!;
    const s = SECTORS[this.sector];
    this.emit({ recordId, mode, stage: "created", node: "a", message: s.reveal(record).headline });
    let current = record;
    for (const hop of ["ab", "bc"] as HopId[]) {
      const [from, to] = (hop === "ab" ? ["a", "b"] : ["b", "c"]) as [NodeId, NodeId];
      const t0 = performance.now();
      const packet = this.send(mode, hop, current);
      packet.view.cryptoMs = performance.now() - t0;
      this.emit({
        recordId,
        mode,
        stage: "sent",
        node: from,
        hop,
        packet: packet.view,
        message: `${s.nodes[from === "a" ? 0 : 1]} → ${s.nodes[to === "b" ? 1 : 2]}`,
      });
      if (pace) await sleep(pace);
      const t1 = performance.now();
      const res = this.receive(mode, hop, packet);
      const openMs = performance.now() - t1;
      if (!res) {
        this.emit({
          recordId,
          mode,
          stage: "rejected",
          node: to,
          hop,
          packet: { ...packet.view, signatureStatus: "invalid", cryptoMs: openMs },
          message: "Rejected",
        });
        return;
      }
      current = res.record;
      this.emit({
        recordId,
        mode,
        stage: hop === "bc" ? "delivered" : "verified",
        node: to,
        hop,
        packet: {
          ...packet.view,
          signatureStatus: res.signatureValid ? "valid" : "invalid",
          cryptoMs: openMs,
        },
        message: hop === "bc" ? `Delivered to ${s.nodes[2]}` : `${s.nodes[1]} verified and routed`,
      });
      if (pace && hop === "ab") await sleep(pace / 3);
    }
  }

  private send(mode: Mode, hop: HopId, record: Record<string, string>) {
    const id = `${this.sector}-${mode}-${++this.packetSeq}`;
    const base = {
      id,
      sector: this.sector,
      recordId: record.recordId!,
      mode,
      hop,
      capturedAt: new Date().toISOString(),
    };
    let harvest: HarvestRecord;
    let view: PacketView;
    if (mode === "classical") {
      const w = this.classical[hop].send(record);
      const bytes = ClassicalLink.size(w);
      harvest = { ...base, bytes, preview: `${w.ciphertext.slice(0, 56)}…`, classical: w };
      view = {
        id,
        recordId: base.recordId,
        sector: this.sector,
        mode,
        hop,
        algLabel: "RSA (tiny stand-in) + ECDSA P-256",
        bytes,
        preview: harvest.preview,
        signatureAlg: "ECDSA P-256",
        signatureStatus: "pending",
      };
    } else {
      const link = this.qsetu[hop];
      const message = link.send(record);
      const bytes = Math.floor((message.ciphertext.length * 3) / 4) + 28;
      harvest = {
        ...base,
        bytes,
        preview: b64Preview(message.ciphertext),
        qsetu: { linkId: link.id, message },
      };
      view = {
        id,
        recordId: base.recordId,
        sector: this.sector,
        mode,
        hop,
        algLabel: "X25519+ML-KEM-768 session · ML-DSA-65",
        bytes,
        preview: harvest.preview,
        signatureAlg: "ML-DSA-65",
        signatureStatus: "pending",
      };
    }
    this.adversary.harvest(harvest);
    return { harvest, view };
  }

  private receive(mode: Mode, hop: HopId, p: { harvest: HarvestRecord }) {
    try {
      return mode === "classical"
        ? this.classical[hop].receive(p.harvest.classical!)
        : this.qsetu[hop].receive(p.harvest.qsetu!.message);
    } catch {
      return undefined;
    }
  }
}
