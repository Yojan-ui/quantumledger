/**
 * The live mesh: real Q-Setu sessions on the twelve globe routes, carrying generated sector records.
 * Each transaction is signed (policy signature algorithm), sealed with the route's hybrid session,
 * opened and verified on the far side, and every step is published to the bus with its measured
 * time. Every so often an on-path attacker flips one ciphertext byte, and AES-GCM rejects it.
 *
 * It only runs while someone is watching (an SSE subscriber), so an idle server does no work.
 */
import { sha3_256 } from "@noble/hashes/sha3.js";
import {
  bytesToHex,
  bytesToUtf8,
  clientFinish,
  clientHello,
  encodeMessage,
  getSig,
  serverComplete,
  serverRespond,
  utf8ToBytes,
  type Session,
} from "@qsetu/core";
import { SECTORS, type SectorId } from "@qsetu/sim";
import { CITY_LABEL, ROUTES, type RouteDef } from "@/data/routes";
import type { Bus } from "./bus";
import type { KeyManager } from "./keystore";
import type { Ledger } from "./ledger";
import type { Policy } from "./policy";
import { SIG_FOR_PROFILE } from "./policy";
import { KEM_LABEL, type PolicyState, type ProfileName, type SigName, type Source } from "./types";

/** Sessions ratchet to a fresh key after this many messages (the moment a policy change lands). */
export const ROTATE_EVERY = 12;
/** One transaction in this many is tampered with on the wire. */
const TAMPER_ONE_IN = 13;
/** One delivered transaction in this many is written to the Q-Ledger. */
const LEDGER_ONE_IN = 3;

interface Link {
  index: number;
  route: RouteDef;
  generation: number;
  profile: ProfileName;
  sig: SigName;
  client: Session;
  server: Session;
  sent: number;
}

interface SiteLink {
  client: Session;
  server: Session;
  profile: ProfileName;
}

const amountOf = (r: Record<string, string>) => {
  const n = Number((r.amountINR ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export class Mesh {
  private links: Link[] = [];
  private sites = new Map<string, SiteLink>();
  private timer?: ReturnType<typeof setTimeout>;
  private tx = 0;
  private delivered = 0;
  private lastMs = 0;
  private ledgerEvery = LEDGER_ONE_IN;

  constructor(
    private readonly bus: Bus,
    private readonly policy: Policy,
    private readonly keys: KeyManager,
    private readonly ledger?: Ledger,
    private readonly opts: { tamperOneIn?: number; random?: () => number } = {},
  ) {}

  private get rand() {
    return this.opts.random ?? Math.random;
  }

  /** Starts ticking while `watching()` is true; checks again every second when idle. */
  start(watching: () => boolean, everyMs = 480): void {
    if (this.timer) return;
    const loop = () => {
      if (watching()) {
        try {
          this.step();
        } catch {
          // A failed step is already on the bus as a REJECT; keep the mesh running.
        }
      }
      // Slow algorithms (SLH-DSA) slow the mesh rather than pinning the CPU.
      const next = watching() ? Math.max(everyMs, this.lastMs * 3) : 1000;
      this.timer = setTimeout(loop, next * (0.7 + this.rand() * 0.6));
      this.timer.unref?.();
    };
    loop();
  }

  stop(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** Runs `n` transactions immediately, logging each one (used to seed the ledger). */
  burst(n: number): void {
    this.ledgerEvery = 1;
    try {
      for (let i = 0; i < n; i++) this.step({ tamper: false });
    } finally {
      this.ledgerEvery = LEDGER_ONE_IN;
    }
  }

  status(): { links: number; linksOnCurrent: number } {
    const g = this.policy.get().generation;
    return {
      links: ROUTES.length,
      linksOnCurrent: this.links.filter((l) => l.generation === g).length,
    };
  }

  /** One transaction on a random route. */
  step(o: { tamper?: boolean; route?: number } = {}): void {
    const t = performance.now();
    try {
      this.transaction(o);
    } finally {
      this.lastMs = performance.now() - t;
    }
  }

  private transaction(o: { tamper?: boolean; route?: number }): void {
    const index = o.route ?? this.pickRoute();
    const link = this.link(index);
    const route = link.route;
    const sector = route.sector as SectorId;
    const record = SECTORS[sector].generate();
    const base = {
      source: "mesh" as const,
      route: index,
      from: route.from,
      to: route.to,
      sector,
    };
    const tamper = o.tamper ?? this.rand() * (this.opts.tamperOneIn ?? TAMPER_ONE_IN) < 1;
    this.tx++;

    // 1. The sender signs the record with the transaction-signing key (policy algorithm).
    const txKey = this.keys.active("tx-signing", link.sig);
    const body = utf8ToBytes(JSON.stringify(record));
    const signature = this.bus.timed(
      { ...base, op: "SIGN", alg: link.sig, detail: `${SECTORS[sector].noun} ${record.recordId}` },
      () => getSig(link.sig).sign(body, txKey.secretKey),
      (s) => s.length,
    );

    // 2. Seal it on the route's session. The session ratchets every ROTATE_EVERY messages.
    const epoch = link.client.epoch;
    const wire = utf8ToBytes(
      JSON.stringify({ r: record, s: Buffer.from(signature).toString("base64") }),
    );
    const msg = this.bus.timed(
      { ...base, op: "SEAL", alg: KEM_LABEL[link.profile], detail: "AES-256-GCM session" },
      () => link.client.seal(wire),
      (m) => encodeMessage(m).length,
    );
    link.sent++;
    if (link.client.epoch !== epoch)
      this.bus.publish({
        ...base,
        op: "ROTATE",
        alg: "hkdf-sha256",
        ms: 0,
        ok: true,
        detail: `${CITY_LABEL[route.from]}–${CITY_LABEL[route.to]} epoch ${link.client.epoch}`,
      });

    // 3. An on-path attacker flips one byte.
    if (tamper) msg.ciphertext[Math.floor(msg.ciphertext.length / 2)]! ^= 0x01;

    // 4. The receiver opens and verifies.
    let opened: Uint8Array;
    try {
      opened = this.bus.timed(
        {
          ...base,
          op: "OPEN",
          alg: KEM_LABEL[link.profile],
          detail: "AES-256-GCM session",
          failDetail: "tampered packet · AES-GCM tag mismatch",
        },
        () => link.server.open(msg),
        (b) => b.length,
      );
    } catch {
      void this.ledger?.append("reject", record.recordId!, {
        sector,
        from: route.from,
        to: route.to,
        reason: "AES-256-GCM tag check failed (tampered packet)",
      });
      this.afterMessage(link);
      return;
    }
    const parsed = JSON.parse(bytesToUtf8(opened)) as { r: Record<string, string>; s: string };
    const ok = this.bus.timed(
      {
        ...base,
        op: "VERIFY",
        alg: link.sig,
        detail: `${SECTORS[sector].noun} ${record.recordId}`,
      },
      () => {
        const valid = getSig(link.sig).verify(
          new Uint8Array(Buffer.from(parsed.s, "base64")),
          utf8ToBytes(JSON.stringify(parsed.r)),
          txKey.publicKey,
        );
        if (!valid) throw new Error("signature invalid");
        return valid;
      },
    );
    if (ok) this.delivered++;
    if (ok && this.ledger && this.delivered % this.ledgerEvery === 0) {
      void this.ledger.append("tx", record.recordId!, {
        sector,
        from: route.from,
        to: route.to,
        ...(amountOf(record) !== undefined ? { amount: amountOf(record) } : {}),
        ctSha3: bytesToHex(sha3_256(msg.ciphertext)).slice(0, 32),
        sig: link.sig,
        kem: KEM_LABEL[link.profile],
      });
    }
    this.afterMessage(link);
  }

  /**
   * A deployed Demo 2 node does one unit of real work: sign, seal, open and verify one record on
   * its own session. Events are tagged with the site ID so the node's counter can climb.
   */
  exercise(site: string, sector: SectorId, adapter: string): void {
    const profile: ProfileName = adapter === "edge" ? "edge" : "standard";
    let s = this.sites.get(site);
    if (!s || s.profile !== profile) {
      const pair = this.handshake(profile, { source: "mesh", site, sector });
      s = { ...pair, profile };
      this.sites.set(site, s);
    }
    const key = this.keys.active("tx-signing", this.policy.get().sig);
    const record = SECTORS[sector].generate();
    const base = { source: adapter as Source, site, sector, from: site };
    const body = utf8ToBytes(JSON.stringify(record));
    const signature = this.bus.timed({ ...base, op: "SIGN", alg: key.meta.alg }, () =>
      getSig(key.meta.alg).sign(body, key.secretKey),
    );
    const msg = this.bus.timed(
      { ...base, op: "SEAL", alg: KEM_LABEL[profile] },
      () => s.client.seal(utf8ToBytes(JSON.stringify({ r: record, n: signature.length }))),
      (m) => encodeMessage(m).length + signature.length,
    );
    this.bus.timed({ ...base, op: "OPEN", alg: KEM_LABEL[profile] }, () => s.server.open(msg));
    this.bus.timed({ ...base, op: "VERIFY", alg: key.meta.alg }, () => {
      if (!getSig(key.meta.alg).verify(signature, body, key.publicKey))
        throw new Error("bad signature");
    });
  }

  private pickRoute(): number {
    // Domestic routes carry most of the traffic.
    const india = ROUTES.map((r, i) => (r.kind === "india" ? i : -1)).filter((i) => i >= 0);
    const world = ROUTES.map((r, i) => (r.kind === "world" ? i : -1)).filter((i) => i >= 0);
    const pool = this.rand() < 0.7 ? india : world;
    return pool[Math.floor(this.rand() * pool.length)]!;
  }

  private link(index: number): Link {
    const existing = this.links.find((l) => l.index === index);
    if (existing) return existing;
    const p = this.policy.get();
    const route = ROUTES[index]!;
    const pair = this.handshake(p.profile, {
      source: "mesh",
      route: index,
      from: route.from,
      to: route.to,
      sector: route.sector,
    });
    const link: Link = {
      index,
      route,
      generation: p.generation,
      profile: p.profile,
      sig: p.sig,
      sent: 0,
      ...pair,
    };
    this.links.push(link);
    return link;
  }

  /** A full hybrid handshake, authenticated by the KMS mesh identity for this profile. */
  private handshake(
    profile: ProfileName,
    tags: {
      source: "mesh";
      route?: number;
      from?: string;
      to?: string;
      sector?: string;
      site?: string;
    },
  ): { client: Session; server: Session } {
    const sigAlg = SIG_FOR_PROFILE[profile];
    const id = this.keys.active("mesh-identity", sigAlg);
    const identity = { profile, publicKey: id.publicKey, secretKey: id.secretKey };
    return this.bus.timed(
      { ...tags, op: "HANDSHAKE", alg: `${KEM_LABEL[profile]} · ${sigAlg}` },
      () => {
        const c = clientHello(profile);
        const s = serverRespond(c.hello, identity);
        const f = clientFinish(c.state, s.serverHello, identity.publicKey, {
          rotateEvery: ROTATE_EVERY,
        });
        const server = serverComplete(s.pending, f.finish, { rotateEvery: ROTATE_EVERY });
        return { client: f.session, server };
      },
    );
  }

  /** At each rotation boundary, a link on an old policy generation re-keys onto the current one. */
  private afterMessage(link: Link): void {
    if (link.sent % ROTATE_EVERY !== 0) return;
    const p: PolicyState = this.policy.get();
    if (link.generation === p.generation) return;
    const pair = this.handshake(p.profile, {
      source: "mesh",
      route: link.index,
      from: link.route.from,
      to: link.route.to,
      sector: link.route.sector,
    });
    const before = `${KEM_LABEL[link.profile]} · ${link.sig}`;
    Object.assign(link, pair, { generation: p.generation, profile: p.profile, sig: p.sig });
    this.bus.publish({
      source: "policy",
      op: "ROTATE",
      alg: `${KEM_LABEL[p.profile]} · ${p.sig}`,
      ms: 0,
      ok: true,
      route: link.index,
      from: link.route.from,
      to: link.route.to,
      detail: `re-keyed from ${before} (policy g${p.generation})`,
    });
  }
}
