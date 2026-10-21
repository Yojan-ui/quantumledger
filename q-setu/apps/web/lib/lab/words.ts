/**
 * The Lab in plain words: the Simple versions of its labels, and the stories told about attacks.
 * Technical mode keeps the original labels; these are what a non-expert reads by default.
 */
import type { ClientFamily, Phase, TimelineStep } from "./types";

/** What each named pattern tried, and what Shield did about it. */
export const PATTERN_STORY: Record<string, { tried: string; shield: string }> = {
  "leaked-key": {
    tried:
      "Used a secret API key that was planted as bait, the way someone with a leaked key would.",
    shield: "Shield recognised the bait key and blocked the sender.",
  },
  "search-impersonation": {
    tried: "Pretended to be Google's crawler to get special treatment.",
    shield: "Shield checked with Google's own records, saw the lie, and flagged it.",
  },
  "secrets-probe": {
    tried: "Looked for leaked passwords and keys in files sites sometimes leave lying around.",
    shield: "Shield showed it fake pages and blocked it.",
  },
  "admin-scan": {
    tried: "Knocked on the doors of common admin and login pages to find a way in.",
    shield: "Shield answered with dead ends and blocked it.",
  },
  "trap-crawler": {
    tried: "Followed an invisible link that only automated tools can see.",
    shield: "Shield knew no person would do that and blocked it.",
  },
  "ai-agent-crawl": {
    tried: "An AI bot raced through dozens of pages much faster than a person reads.",
    shield: "Shield slowed it right down.",
  },
  "api-flood": {
    tried: "Sent a burst of payment requests far faster than any real customer.",
    shield: "Shield slowed it down so the site stayed up for everyone else.",
  },
  "route-enumeration": {
    tried: "Guessed at page addresses one after another to map the site.",
    shield: "Shield noticed the pattern and slowed it down.",
  },
  other: {
    tried: "Behaved like an automated tool rather than a person.",
    shield: "Shield flagged it for a person to look at.",
  },
};

export const patternStory = (id: string) => PATTERN_STORY[id] ?? PATTERN_STORY.other!;

export function danger(score: number): "high" | "medium" | "low" {
  return score >= 80 ? "high" : score >= 30 ? "medium" : "low";
}

const CLIENT: Record<ClientFamily, string> = {
  browser: "a web browser",
  headless: "a hidden, automated browser",
  script: "a script",
  "ai-agent": "an AI bot",
  "search-bot": "something claiming to be a search engine",
  none: "an unnamed tool",
  other: "an unknown tool",
};
export const clientWords = (c: ClientFamily) => CLIENT[c] ?? "an unknown tool";

export const PHASE_WORDS: Record<Phase, string> = {
  browse: "looked around",
  recon: "scouted",
  probe: "hunted for secrets",
  credential: "tried a stolen key",
  abuse: "flooded the site",
  blocked: "turned away",
};

export const ACTION_WORDS: Record<string, string> = {
  allow: "let through",
  block: "blocked",
  limit: "slowed down",
  challenge: "challenged",
};

/** "just now", "4 min ago", "3 h ago", "yesterday", "5 days ago". */
export function agoWords(t: number, now = Date.now()): string {
  const s = Math.max(0, (now - t) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  if (s < 172_800) return "yesterday";
  return `${Math.round(s / 86_400)} days ago`;
}

/** "Practice attack · 2 min ago" (the lab's own test traffic) or "Attack · 2 min ago". */
export const incidentWords = (synthetic: boolean, lastSeen: number) =>
  `${synthetic ? "Practice attack" : "Attack"} · ${agoWords(lastSeen)}`;

/** Steps Shield turned away (blocked, challenged or slowed) out of all of them. */
export function stopped(actions: Record<string, number>) {
  const total = Object.values(actions).reduce((a, b) => a + b, 0);
  const refused = (actions.block ?? 0) + (actions.challenge ?? 0) + (actions.limit ?? 0);
  return { refused, total };
}

export function shieldSentence(actions: Record<string, number>): string {
  const { refused, total } = stopped(actions);
  if (!total) return "Nothing reached Shield yet.";
  if (!refused) return `Shield let all ${total} steps through, but kept a record of each.`;
  return `Shield blocked ${refused} of ${total} step${total === 1 ? "" : "s"}.`;
}

/** What one request was, in plain words. */
function what(s: Pick<TimelineStep, "method" | "route" | "routeClass" | "types">): string {
  if (s.types.includes("canary")) return "used a bait API key";
  if (s.routeClass === "secrets") return `asked for ${s.route}, a file that often holds passwords`;
  if (s.routeClass === "admin") return `tried the admin page ${s.route}`;
  if (s.routeClass === "trap") return "followed a hidden link only bots can see";
  if (s.routeClass === "api" && s.method !== "GET") return `sent a request to ${s.route}`;
  if (s.route === "/") return "opened the home page";
  return `asked for ${s.route}`;
}

export interface StoryStep {
  /** 1-based, first and last step this line covers. */
  from: number;
  to: number;
  text: string;
  outcome: "through" | "stopped";
  phase: Phase;
}

/**
 * The incident as a short numbered story: consecutive steps that did the same thing and got the
 * same answer become one line ("Steps 3–42: sent 40 requests to /api/transfer in 1.3 s…").
 */
export function story(steps: TimelineStep[], client: ClientFamily | undefined): StoryStep[] {
  const out: StoryStep[] = [];
  let i = 0;
  while (i < steps.length) {
    const s = steps[i]!;
    let j = i;
    const key = (x: TimelineStep) =>
      `${x.phase}|${x.action}|${x.routeClass === "page" && x.status === 404 ? "404" : x.route}|${x.method}`;
    while (j + 1 < steps.length && key(steps[j + 1]!) === key(s)) j++;
    const n = j - i + 1;
    const through = s.action === "allow";
    const verb = what(s);
    const answer = through
      ? s.status === 404
        ? "The page wasn't there."
        : "It got an answer."
      : s.types.includes("honeypot") || s.types.includes("trap")
        ? "Shield showed it a fake page and blocked it."
        : s.types.includes("canary")
          ? "Shield recognised the bait and blocked it."
          : s.action === "limit"
            ? "Shield slowed it down."
            : s.action === "challenge"
              ? "Shield asked it to prove it was a person."
              : "Shield refused it.";
    const missing = s.routeClass === "page" && s.status === 404 && through;
    const lead = i === 0 && client ? `It came from ${clientWords(client)}. ` : "";
    const body =
      n === 1
        ? cap(verb)
        : missing
          ? `Tried ${n} pages that don't exist${duration(s, steps[j]!)}`
          : `${cap(verb)}, ${n} times${duration(s, steps[j]!)}`;
    const end = n > 1 && missing ? "None of them were there." : answer;
    const text = `${lead}${body}. ${end}`;
    out.push({
      from: i + 1,
      to: j + 1,
      text,
      outcome: through ? "through" : "stopped",
      phase: s.phase,
    });
    i = j + 1;
  }
  return out;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function duration(a: TimelineStep, b: TimelineStep) {
  const ms = b.offsetMs - a.offsetMs;
  if (ms < 1000) return " in under a second";
  if (ms < 60_000) return ` in ${(ms / 1000).toFixed(1)} seconds`;
  return ` over ${Math.round(ms / 60_000)} minutes`;
}
