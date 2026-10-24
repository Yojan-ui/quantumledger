/**
 * Detect: turns what Shield's risk engine flags into structured, privacy-safe events.
 *
 * Shield's middleware is used exactly as shipped. A small middleware in front of it opens an
 * AsyncLocalStorage context for each request; Shield's `onEvent` hook (fired inside `check()`) writes
 * the engine's event into that context, and when the response finishes the recorder has the whole
 * picture: route, method, client family, signals, score, what Shield did and the status sent.
 *
 * Only flagged requests open an incident. Once one is open, the source's other requests are kept
 * too (unflagged), so the timeline shows the steps around the flags, and the last few requests
 * before the first flag are added as context.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { IncomingMessage, ServerResponse } from "node:http";
import { shield, type ShieldOptions } from "@qsetu/shield";
import { PASS_COOKIE, type Action, type GuardEvent } from "@qsetu/shield-guard";
import { clientFamily, hashOf, ipHash, netHash, safeRoute } from "./privacy";
import { requestShape } from "./model/features";
import type { LiveModel } from "./model/learn";
import { DEFAULT_SITE, type EvidenceStore } from "./store";
import type { AttackEvent } from "./types";

/** Requests carrying this header are labelled synthetic: the lab's own test traffic. */
export const SYNTHETIC_HEADER = "x-attack-lab-synthetic";

const ATTACK_TYPES = new Set<GuardEvent["type"]>([
  "limit",
  "challenge",
  "block",
  "honeypot",
  "trap",
  "canary",
  "bot_impersonation",
]);

export interface RecorderOptions {
  store: EvidenceStore;
  /**
   * The protected site (customer) these requests belong to. A fixed string for a real install; a
   * function only where one server stands in for several sites, as the sandbox does.
   */
  site?: string | ((req: IncomingMessage) => string);
  /** Salt for the IP and session hashes (≥ 16 characters). Keep it with the lab, never in the records. */
  salt: string;
  canaryKeys?: string[];
  asnOf?: (ip: string) => string | undefined;
  /**
   * Read the JA4 fingerprint from Shield Edge's `x-qsetu-ja4` header. Only set this when every
   * request reaches the app through Shield Edge (it strips a client-supplied copy).
   */
  trustEdgeHeaders?: boolean;
  /** The threat model: scores every finished request; its verdict is signed into the record. */
  model?: LiveModel;
  /** Requests kept from before a source's first flag. Default 20, from the last 5 minutes. */
  contextMax?: number;
  contextWindowMs?: number;
}

interface Ctx {
  at: number;
  types: GuardEvent["type"][];
  signals: string[];
  score: number;
  monitorOnly: boolean;
}

const one = (h: string | string[] | undefined) => (Array.isArray(h) ? h[0] : h) ?? "";

function cookie(raw: string, name: string): string | undefined {
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

function actionOf(types: GuardEvent["type"][], status: number, monitorOnly: boolean): Action {
  if (monitorOnly) return "allow";
  if (types.some((t) => t === "block" || t === "honeypot" || t === "trap" || t === "canary"))
    return "block";
  if (types.includes("challenge")) return status === 429 ? "limit" : "challenge";
  if (types.includes("limit") || status === 429) return "limit";
  // Shield answers "blocked earlier" with a 403 and no new event.
  if (status === 403) return "block";
  return "allow";
}

export function createRecorder(o: RecorderOptions) {
  if (!o.salt || o.salt.length < 16)
    throw new Error("Recorder salt must be at least 16 characters");
  const als = new AsyncLocalStorage<Ctx>();
  const context = new Map<string, AttackEvent[]>();
  const max = o.contextMax ?? 20;
  const windowMs = o.contextWindowMs ?? 5 * 60_000;

  const srcKey = (e: AttackEvent) => `${e.site}|${e.source.ipHash}`;

  function remember(e: AttackEvent) {
    const list = (context.get(srcKey(e)) ?? []).filter((x) => e.at - x.at <= windowMs);
    list.push(e);
    context.delete(srcKey(e));
    context.set(srcKey(e), list.slice(-max));
    // Bounded: drop the oldest sources first.
    if (context.size > 10_000) context.delete(context.keys().next().value!);
  }

  const api = {
    /** Pass as Shield's `onEvent`. */
    onEvent(e: GuardEvent) {
      const c = als.getStore();
      if (!c || !ATTACK_TYPES.has(e.type)) return;
      c.types.push(e.type);
      for (const r of e.reasons) if (!c.signals.includes(r)) c.signals.push(r);
      c.score = Math.max(c.score, e.score);
      c.monitorOnly = e.monitorOnly;
    },

    /** Builds the privacy-safe event for a finished request. */
    event(req: IncomingMessage, ip: string, status: number, c: Ctx): AttackEvent {
      const pass = cookie(one(req.headers.cookie), PASS_COOKIE);
      const asn = o.asnOf?.(ip);
      const ja4 = o.trustEdgeHeaders ? one(req.headers["x-qsetu-ja4"]) : "";
      return {
        site: (typeof o.site === "function" ? o.site(req) : o.site) || DEFAULT_SITE,
        at: c.at,
        source: {
          ipHash: ipHash(o.salt, ip),
          netHash: netHash(o.salt, ip),
          ...(asn ? { asn } : {}),
          ...(pass ? { sessionHash: hashOf(o.salt, `pass:${pass.slice(0, 24)}`) } : {}),
        },
        ...(ja4 ? { tls: { ja4: ja4.slice(0, 64) } } : {}),
        client: clientFamily(one(req.headers["user-agent"])),
        method: (req.method ?? "GET").toUpperCase().slice(0, 10),
        route: safeRoute(req.url ?? "/", o.canaryKeys),
        // Numbers only: the query and body text are never kept.
        shape: requestShape(
          safeRoute(req.url ?? "/", o.canaryKeys) +
            ((req.url ?? "").includes("?")
              ? (req.url ?? "").slice((req.url ?? "").indexOf("?"))
              : ""),
          "",
          Number(one(req.headers["content-length"])) || 0,
        ),
        flagged: c.types.length > 0,
        types: [...new Set(c.types)],
        signals: c.signals,
        score: c.score,
        action: actionOf(c.types, status, c.monitorOnly),
        status,
        monitorOnly: c.monitorOnly,
        synthetic: one(req.headers[SYNTHETIC_HEADER]) === "1",
      };
    },

    /** Stores the event if it belongs on record, with any context from before the first flag. */
    keep(event: AttackEvent) {
      const m = o.model?.observe(event);
      const e = m?.verdict ? { ...event, model: m.verdict } : event;
      if (o.store.openIncidentFor(e)) return void o.store.append(e);
      if (!e.flagged) {
        // Let through and not part of an incident: a safe example for the model.
        if (m) o.model!.addNormal(m.x);
        return remember(e);
      }
      for (const x of context.get(srcKey(e)) ?? []) o.store.append(x);
      context.delete(srcKey(e));
      o.store.append(e);
    },

    /** Middleware to install just before Shield's. `ipOf` must resolve the IP the way Shield does. */
    middleware(ipOf: (req: IncomingMessage) => string) {
      return (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
        const c: Ctx = { at: Date.now(), types: [], signals: [], score: 0, monitorOnly: false };
        res.on("finish", () => {
          try {
            api.keep(api.event(req, ipOf(req), res.statusCode, c));
          } catch {
            // Recording must never affect the site.
          }
        });
        als.run(c, () => next());
      };
    },
  };
  return api;
}

export type Recorder = ReturnType<typeof createRecorder>;

/**
 * Shield, recorded: Shield's own Express middleware with a recorder in front of it. Returns the two
 * middlewares in the order to install them.
 */
export function recordedShield(shieldOpts: ShieldOptions, rec: RecorderOptions) {
  const recorder = createRecorder(rec);
  const mw = shield({
    ...shieldOpts,
    canaryKeys: shieldOpts.canaryKeys ?? rec.canaryKeys,
    onEvent: (e) => {
      shieldOpts.onEvent?.(e);
      recorder.onEvent(e);
    },
  });
  const ipOf = (req: IncomingMessage) =>
    mw.shield.clientIp(req.socket.remoteAddress, req.headers["x-forwarded-for"]);
  return { use: [recorder.middleware(ipOf), mw], shield: mw.shield, recorder };
}
