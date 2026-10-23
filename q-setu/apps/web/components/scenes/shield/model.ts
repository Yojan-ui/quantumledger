/**
 * "Shield plugs in": the one model behind the scene, its caption, its counters and its console.
 * Everything on screen is `view(events, t)`: the events of a real run (live from
 * /api/shield/plugin, or a recorded run) and a story time `t` in beats. The live player advances `t`
 * as events arrive; the homepage maps scroll to `t`. Nothing else holds state, so the counter, the
 * caption and the console can't disagree (docs/art/slop-audit.md D1).
 */
import type { InstallMode, Measured, PluginEvent } from "@/lib/server/shield-plugin";
import { CHECKS, type CheckId } from "@/lib/shield-score";

export type { InstallMode, Measured, PluginEvent };

export interface AttackSummary {
  sent: number;
  refused: number;
  answered: number;
  honeypot: boolean;
}

export const BEATS = [
  "scan",
  "install",
  "handshake",
  "harvest",
  "fix",
  "verify",
  "attack",
] as const;
export type BeatId = (typeof BEATS)[number];

/** The event each beat waits for before it can play. */
const NEEDS: Record<BeatId, PluginEvent["t"]> = {
  scan: "scan",
  install: "install",
  handshake: "handshake",
  harvest: "handshake",
  fix: "rescan",
  verify: "report",
  attack: "done",
};

export interface View {
  beat: number;
  beatId: BeatId;
  /** 0–1 progress through the current beat. */
  within: number;
  mode: InstallMode;
  before?: Measured;
  after?: Measured;
  /** Shield is in place (the install beat has played). */
  installed: boolean;
  installArtifact?: string;
  installNote?: string;
  /** The handshake re-formed into the hybrid group (DNS / container). */
  upgraded: boolean;
  handshake?: { group: string; ms: number; quantumSafe: boolean };
  /** Real handshakes so far: the visitors' capsules. */
  visits: { n: number; group: string; ms: number; quantumSafe: boolean }[];
  /** Handshakes a recorder on the line could have kept, and how many of those open at Q-Day. */
  recorded: number;
  exposed: number;
  /** Check id → state, revealed one by one during the fix beat. */
  fixes: Partial<Record<CheckId, { ok: boolean; partial?: boolean; seen?: string }>>;
  /** The score on screen right now. */
  score?: number;
  report?: { url: string; signedAt: string };
  attack?: AttackSummary;
  sim: string[];
  /** Console lines for everything shown so far. */
  log: {
    ms: string;
    verb: string;
    text: string;
    tone: "exposed" | "safe" | "verified" | "plain";
  }[];
  caption: string;
  /** The beat's figure title (the step name in the caption bar). */
  step: string;
}

/** How far the events allow the story to go: the first beat whose event hasn't arrived. */
export function available(events: PluginEvent[], attack?: AttackSummary): number {
  const have = new Set(events.map((e) => e.t));
  let b = 0;
  for (const id of BEATS) {
    if (id === "attack" ? !attack : !have.has(NEEDS[id])) break;
    b++;
  }
  return b;
}

const fmtMs = (ms: number) => `${ms.toFixed(2)} ms`;

export function view(
  events: PluginEvent[],
  t: number,
  mode: InstallMode,
  attack?: AttackSummary,
): View {
  const beat = Math.max(0, Math.min(BEATS.length - 1, Math.floor(t)));
  const within = Math.max(0, Math.min(1, t - beat));
  const beatId = BEATS[beat]!;
  const of = <T extends PluginEvent["t"]>(k: T) =>
    events.filter((e) => e.t === k) as Extract<PluginEvent, { t: T }>[];
  const start = of("start")[0];
  const scan = of("scan")[0];
  const install = of("install")[0];
  const hs = of("handshake")[0];
  const rescan = of("rescan")[0];
  const report = of("report")[0];
  const fixEvents = of("fix");

  const installed = !!install && beat >= 1 && (beat > 1 || within > 0.35);
  const upgraded = !!hs?.quantumSafe && beat >= 2;
  // Visitors 1–3 cross during the scan; 4–6 after Shield is in.
  const visits = of("visit").filter((v) => (v.n <= 3 ? beat >= 0 : beat >= 2));
  const recorded = visits.length;
  const exposed = visits.filter((v) => !v.quantumSafe).length;

  // Fixes appear one by one through the fix beat, then all stay.
  const shownFixes =
    beat > 4 ? fixEvents.length : beat === 4 ? Math.ceil(within * fixEvents.length) : 0;
  const fixes: View["fixes"] = {};
  for (const f of fixEvents.slice(0, shownFixes))
    fixes[f.id] = {
      ok: f.ok,
      ...(f.partial ? { partial: true } : {}),
      ...(f.seen ? { seen: f.seen } : {}),
    };

  // The score: the scan's until verify, then counting up to the rescan's through the verify beat.
  let score = scan?.before.score;
  if (rescan && scan && beat >= 5) {
    const k = beat > 5 ? 1 : Math.min(1, within * 1.6);
    score = Math.round(scan.before.score + (rescan.after.score - scan.before.score) * k);
  }

  const log: View["log"] = [];
  if (scan) {
    const b = scan.before;
    log.push({
      ms: "",
      verb: "SCAN",
      text: `${b.protocol} · ${b.group} · ${b.certKey} · score ${b.score}`,
      tone: "exposed",
    });
  }
  for (const v of visits)
    log.push({
      ms: fmtMs(v.ms),
      verb: v.quantumSafe ? "SEALED" : "RECORDED",
      text: `visitor ${v.n} · ${v.group}${v.quantumSafe ? " · unreadable to a recorder" : " · opens at Q-Day"}`,
      tone: v.quantumSafe ? "safe" : "exposed",
    });
  if (installed && install)
    log.push({ ms: "", verb: "INSTALL", text: install.artifact, tone: "plain" });
  if (hs && beat >= 2)
    log.push({
      ms: fmtMs(hs.ms),
      verb: "HANDSHAKE",
      text: `${hs.group}${hs.quantumSafe ? " · hybrid post-quantum" : " · classical (TLS unchanged)"}`,
      tone: hs.quantumSafe ? "safe" : "exposed",
    });
  for (const c of CHECKS) {
    const f = fixes[c.id];
    if (!f) continue;
    log.push({
      ms: "",
      verb: f.ok ? "FIXED" : f.partial ? "PARTIAL" : "OPEN",
      text: `${c.plate}${f.seen ? ` · ${f.seen}` : ""}`,
      tone: f.ok ? "verified" : f.partial ? "plain" : "exposed",
    });
  }
  if (rescan && beat >= 5)
    log.push({
      ms: "",
      verb: "RESCAN",
      text: `${rescan.after.protocol} · ${rescan.after.group} · score ${rescan.after.score}`,
      tone: rescan.after.hybridPq ? "safe" : "plain",
    });
  if (report && beat >= 5)
    log.push({
      ms: "",
      verb: "SIGNED",
      text: "Quantum-Ready report · ML-DSA-65",
      tone: "verified",
    });
  if (attack && beat >= 6)
    log.push({
      ms: "",
      verb: "ATTACK",
      text: `${attack.sent} requests · ${attack.refused} turned away · ${attack.answered} answered${attack.honeypot ? " · /.env honeypot hit" : ""}`,
      tone: "plain",
    });

  const pq = mode !== "code";
  // The handshake in the caption is the median of the visitors after Shield went in: the very first
  // connection to a freshly started edge includes its start-up, and the plate says so.
  const nextMs = of("visit")
    .filter((x) => x.n >= 4)
    .map((x) => x.ms)
    .sort((a, b) => a - b);
  const typical = nextMs.length ? nextMs[Math.floor(nextMs.length / 2)]! : hs?.ms;
  const after = rescan?.after;
  const CAPTION: Record<BeatId, string> = {
    scan: "Today every visitor's handshake to the bank is classical, and a recorder on the line can keep all of it.",
    install:
      mode === "dns"
        ? "Shield seats between the internet and your server. Nothing in your code changes."
        : mode === "container"
          ? "Shield docks beside your server, and every connection passes through it."
          : "One line in your app: Shield's defence and headers, inside the code.",
    handshake: pq
      ? `Handshakes now re-form at Shield as ${hs?.group ?? "X25519MLKEM768"}: ${typical !== undefined ? fmtMs(typical) : "under a millisecond"} each, measured.`
      : "With one line of code the handshake stays X25519: post-quantum TLS needs the DNS or container route.",
    harvest: pq
      ? "New captures are unreadable. What was recorded before Shield stays exposed if those keys were classical."
      : "The recorder still keeps every handshake: the TLS in front of the app hasn't changed.",
    fix: "Shield hardens the edge: each finding is fixed, or stays open with its reason.",
    verify: `A fresh scan from outside: ${scan?.before.score ?? "–"} → ${after?.score ?? "–"}. The report is signed with ML-DSA-65.`,
    attack: attack
      ? `A scripted agent (a burst, an AI crawler, the honeypots) hits Shield: ${attack.refused} of ${attack.sent} requests turned away before the bank.`
      : "A scripted agent hits Shield.",
  };
  const STEP: Record<BeatId, string> = {
    scan: "Scan",
    install: "Install",
    handshake: "Handshake",
    harvest: "Recorder",
    fix: "Fix",
    verify: "Verify",
    attack: "Attack",
  };
  return {
    beat,
    beatId,
    within,
    mode,
    ...(scan ? { before: scan.before } : {}),
    ...(after && beat >= 5 ? { after } : {}),
    installed,
    ...(install ? { installArtifact: install.artifact, installNote: install.note } : {}),
    upgraded,
    ...(hs && beat >= 2
      ? { handshake: { group: hs.group, ms: hs.ms, quantumSafe: hs.quantumSafe } }
      : {}),
    visits,
    recorded,
    exposed,
    fixes,
    ...(score !== undefined ? { score } : {}),
    ...(report && beat >= 5 ? { report: { url: report.url, signedAt: report.signedAt } } : {}),
    ...(attack && beat >= 6 ? { attack } : {}),
    sim: start?.sim ?? [],
    log,
    caption: CAPTION[beatId],
    step: STEP[beatId],
  };
}

/** Summarises the attack suite's results for the scene. */
export function summariseAttack(
  results: { attack: string; sent: number; refused: number; answered: number }[],
): AttackSummary {
  return {
    sent: results.reduce((n, r) => n + r.sent, 0),
    refused: results.reduce((n, r) => n + r.refused, 0),
    answered: results.reduce((n, r) => n + r.answered, 0),
    honeypot: results.some((r) => r.attack.startsWith("Honeypots") && r.refused > 0),
  };
}
