/**
 * The evidence log: append-only, hash-chained and signed. Every event is signed as it is written;
 * each incident is re-signed (sealed) shortly after it changes, covering the hashes of all its
 * events. There is no update or delete: records are frozen in memory and the file is only appended
 * to, so the only way to change the evidence is to edit the file, and that breaks the chain or a
 * signature, which `verify()` reports.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { verifyRecord, type RecordCheck, type Signer } from "./sign";
import type { AttackEvent, EventRecord, Incident, IncidentRecord, SignedRecord } from "./types";

export interface StoreOptions {
  signer: Signer;
  /** Directory for records.jsonl. Leave unset to keep everything in memory (tests). */
  dir?: string;
  /** Events this close to an incident's last event, from the same IP or session, join it. Default 30 min. */
  linkWindowMs?: number;
  /** How long to wait after a change before re-signing an incident. Default 1.5 s. */
  sealDelayMs?: number;
}

export interface ChainReport {
  ok: boolean;
  records: number;
  problems: { seq: number; reason: "chain" | "format" | "key" | "hash" | "signature" }[];
}

export interface IncidentCheck {
  ok: boolean;
  events: number;
  /** Events individually signed but newer than the last incident seal. */
  unsealed: number;
  badEvents: string[];
  seal: RecordCheck | { ok: false; reason: "missing" | "mismatch" };
}

function freeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) freeze(v);
  }
  return o;
}

const uniq = <T>(a: T[], v: T | undefined) => (v === undefined || a.includes(v) ? a : [...a, v]);

export class EvidenceStore {
  private readonly records: SignedRecord[] = [];
  private readonly events = new Map<string, EventRecord>();
  private readonly incidents = new Map<string, Incident>();
  private readonly seals = new Map<string, IncidentRecord>();
  private readonly byIp = new Map<string, string>();
  private readonly bySession = new Map<string, string>();
  private readonly dirty = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly file: string | undefined;
  private readonly window: number;
  readonly signer: Signer;

  constructor(private readonly opts: StoreOptions) {
    this.signer = opts.signer;
    this.window = opts.linkWindowMs ?? 30 * 60_000;
    if (opts.dir) {
      mkdirSync(opts.dir, { recursive: true });
      this.file = join(opts.dir, "records.jsonl");
      if (existsSync(this.file))
        for (const line of readFileSync(this.file, "utf8").split("\n"))
          if (line.trim()) this.load(JSON.parse(line) as SignedRecord);
    }
  }

  get publicKey() {
    return this.signer.publicKey;
  }

  get size() {
    return this.records.length;
  }

  private load(r: SignedRecord) {
    this.records.push(freeze(r));
    if (r.kind === "event") this.index(r as EventRecord);
    else this.seals.set((r as IncidentRecord).body.id, r as IncidentRecord);
  }

  private write<T>(kind: SignedRecord["kind"], body: T): SignedRecord<T> {
    const prev = this.records.at(-1)?.hash ?? "";
    const rec = freeze(this.signer.sign<T>({ v: 1, kind, seq: this.records.length, prev, body }));
    this.records.push(rec);
    if (this.file) appendFileSync(this.file, JSON.stringify(rec) + "\n");
    return rec;
  }

  /** The open incident this event belongs to, if any. */
  openIncidentFor(ev: Pick<AttackEvent, "at" | "source">): string | undefined {
    const ids = [this.byIp.get(ev.source.ipHash)];
    if (ev.source.sessionHash) ids.push(this.bySession.get(ev.source.sessionHash));
    let best: Incident | undefined;
    for (const id of ids) {
      const inc = id ? this.incidents.get(id) : undefined;
      if (inc && ev.at - inc.lastSeen <= this.window && (!best || inc.lastSeen > best.lastSeen))
        best = inc;
    }
    return best?.id;
  }

  /** Records one event: links it to an incident (opening one if needed) and signs it. */
  append(ev: AttackEvent): EventRecord {
    const seq = this.records.length;
    const incidentId = this.openIncidentFor(ev) ?? `inc_${String(seq).padStart(6, "0")}`;
    const rec = this.write("event", { ...ev, id: `ev_${seq}`, incidentId }) as EventRecord;
    this.index(rec);
    this.dirty.add(incidentId);
    this.scheduleSeal();
    for (const l of this.listeners) l();
    return rec;
  }

  private index(rec: EventRecord) {
    const e = rec.body;
    this.events.set(e.id, rec);
    const prev = this.incidents.get(e.incidentId);
    const inc: Incident = prev ?? {
      id: e.incidentId,
      opened: e.at,
      lastSeen: e.at,
      ipHashes: [],
      sessionHashes: [],
      asns: [],
      clients: [],
      eventIds: [],
      eventHashes: [],
      flagged: 0,
      maxScore: 0,
      signals: [],
      types: [],
      synthetic: true,
    };
    inc.lastSeen = Math.max(inc.lastSeen, e.at);
    inc.ipHashes = uniq(inc.ipHashes, e.source.ipHash);
    inc.sessionHashes = uniq(inc.sessionHashes, e.source.sessionHash);
    inc.asns = uniq(inc.asns, e.source.asn);
    inc.clients = uniq(inc.clients, e.client);
    inc.eventIds = [...inc.eventIds, e.id];
    inc.eventHashes = [...inc.eventHashes, rec.hash];
    if (e.flagged) inc.flagged++;
    inc.maxScore = Math.max(inc.maxScore, e.score);
    for (const s of e.signals) inc.signals = uniq(inc.signals, s);
    for (const t of e.types) inc.types = uniq(inc.types, t);
    inc.synthetic = inc.synthetic && e.synthetic;
    this.incidents.set(inc.id, inc);
    this.byIp.set(e.source.ipHash, inc.id);
    if (e.source.sessionHash) this.bySession.set(e.source.sessionHash, inc.id);
  }

  private scheduleSeal() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.sealDirty();
    }, this.opts.sealDelayMs ?? 1500);
    this.timer.unref?.();
  }

  /** Signs a snapshot of every incident that changed since its last seal. */
  sealDirty() {
    for (const id of this.dirty) {
      const inc = this.incidents.get(id);
      if (inc) this.seals.set(id, this.write("incident", structuredClone(inc)) as IncidentRecord);
    }
    this.dirty.clear();
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    for (const l of this.listeners) l();
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Incidents, newest activity first. Copies: the store's own state can't be changed through them. */
  listIncidents(): Incident[] {
    return [...this.incidents.values()]
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .map((i) => structuredClone(i));
  }

  incident(id: string): Incident | undefined {
    const i = this.incidents.get(id);
    return i && structuredClone(i);
  }

  /** The incident's event records, oldest first (frozen). */
  eventsOf(id: string): EventRecord[] {
    return (this.incidents.get(id)?.eventIds ?? []).map((e) => this.events.get(e)!);
  }

  /** One record exactly as stored and signed. */
  record(seq: number): SignedRecord | undefined {
    return this.records[seq];
  }

  seal(id: string): IncidentRecord | undefined {
    return this.seals.get(id);
  }

  /** Every record's hash, signature and link to the one before it. */
  verify(): ChainReport {
    const problems: ChainReport["problems"] = [];
    let prev = "";
    for (const [i, r] of this.records.entries()) {
      if (r.seq !== i || r.prev !== prev) problems.push({ seq: i, reason: "chain" });
      const c = verifyRecord(r, this.publicKey);
      if (!c.ok) problems.push({ seq: i, reason: c.reason });
      prev = r.hash;
    }
    return { ok: problems.length === 0, records: this.records.length, problems };
  }

  /** One incident: its events' signatures, and its latest seal against the events it covers. */
  verifyIncident(id: string): IncidentCheck | undefined {
    const inc = this.incidents.get(id);
    if (!inc) return undefined;
    const events = this.eventsOf(id);
    const badEvents = events
      .filter((e) => !verifyRecord(e, this.publicKey).ok)
      .map((e) => e.body.id);
    const s = this.seals.get(id);
    let seal: IncidentCheck["seal"] = { ok: false, reason: "missing" };
    let unsealed = events.length;
    if (s) {
      const c = verifyRecord(s, this.publicKey);
      const covered = s.body.eventHashes;
      const matches = covered.every((h, i) => events[i]?.hash === h);
      seal = !c.ok ? c : matches ? { ok: true } : { ok: false, reason: "mismatch" };
      unsealed = events.length - covered.length;
    }
    return {
      ok: badEvents.length === 0 && seal.ok,
      events: events.length,
      unsealed,
      badEvents,
      seal,
    };
  }

  close() {
    if (this.dirty.size) this.sealDirty();
    if (this.timer) clearTimeout(this.timer);
  }
}
