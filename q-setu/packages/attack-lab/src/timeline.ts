/**
 * Map: an incident as a step-by-step timeline of what the source did, ready to draw. Each step
 * gets a phase from what it touched and how Shield answered, so a dashboard can colour and group it
 * without knowing anything about the engine.
 */
import { routeClass } from "./privacy";
import type { EventRecord, Phase, TimelineStep } from "./types";

const RATE = /request rate|fast requests|burst/;

export function phaseOf(s: Omit<TimelineStep, "phase" | "i" | "offsetMs">): Phase {
  if (s.types.includes("canary")) return "credential";
  if (
    s.routeClass === "secrets" ||
    s.routeClass === "admin" ||
    s.routeClass === "trap" ||
    s.types.includes("honeypot") ||
    s.types.includes("trap")
  )
    return "probe";
  if (!s.flagged && s.action === "block") return "blocked";
  if (s.routeClass === "api" && s.method !== "GET") return "abuse";
  if (s.signals.some((x) => RATE.test(x))) return "abuse";
  if (s.flagged || s.status === 404) return "recon";
  return "browse";
}

export interface Timeline {
  incidentId: string;
  steps: TimelineStep[];
  durationMs: number;
  /** Index of the first step Shield refused (blocked, challenged or limited), if any. */
  firstStop?: number;
  phases: Partial<Record<Phase, number>>;
  actions: Record<string, number>;
}

export function buildTimeline(
  incidentId: string,
  events: EventRecord[],
  opts: { trapPath?: string } = {},
): Timeline {
  const sorted = [...events].sort((a, b) => a.body.at - b.body.at || a.seq - b.seq);
  const t0 = sorted[0]?.body.at ?? 0;
  const steps = sorted.map((r, i): TimelineStep => {
    const e = r.body;
    const base = {
      eventId: e.id,
      at: e.at,
      method: e.method,
      route: e.route,
      routeClass: routeClass(e.route, opts.trapPath),
      flagged: e.flagged,
      signals: e.signals,
      types: e.types,
      score: e.score,
      action: e.action,
      status: e.status,
      client: e.client,
    };
    return { i, offsetMs: e.at - t0, phase: phaseOf(base), ...base };
  });
  const phases: Timeline["phases"] = {};
  const actions: Record<string, number> = {};
  for (const s of steps) {
    phases[s.phase] = (phases[s.phase] ?? 0) + 1;
    actions[s.action] = (actions[s.action] ?? 0) + 1;
  }
  const stop = steps.findIndex((s) => s.action !== "allow");
  return {
    incidentId,
    steps,
    durationMs: steps.at(-1)?.offsetMs ?? 0,
    ...(stop >= 0 ? { firstStop: stop } : {}),
    phases,
    actions,
  };
}
