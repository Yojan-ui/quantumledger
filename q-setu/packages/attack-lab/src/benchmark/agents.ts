/**
 * The benchmark's attacker agents. Each pursues one goal step by step against the local sandbox,
 * reusing the behaviour categories the Lab already models (../simulate, ../threats) — behaviour
 * only, no new exploit code. Every agent runs the same request plan against both sandbox copies
 * (bare, and behind PQC + Shield) so the two can be compared.
 *
 * These only ever target the two loopback copies of apps/legacy-bank. The runner routes every
 * request through the host guard (../hostguard), which refuses any non-loopback target.
 */

/** One request in an agent's plan. `gapMs` is the pause before it; `parallel` fires it without waiting. */
export interface AgentRequest {
  method: "GET" | "POST";
  path: string;
  headers?: Record<string, string>;
  gapMs?: number;
  parallel?: boolean;
  /** True for the request that would achieve the agent's goal if it got through. */
  objective?: boolean;
  /** Presents the sandbox's decoy credential (filled by the runner). */
  canary?: boolean;
}

export interface Agent {
  id: string;
  label: string;
  /** What the agent is trying to do, in plain words. */
  goal: string;
  /** The behaviour the Lab's model already recognises (for the news/threat mapping). */
  category: string;
  /** The ordered requests, capped by `cap` (per-agent request budget). */
  plan(ctx: { trapPath: string; cap: number }): AgentRequest[];
}

const n = (count: number, make: (i: number) => AgentRequest): AgentRequest[] =>
  Array.from({ length: count }, (_, i) => make(i));

export const AGENTS: Agent[] = [
  {
    id: "flooder",
    label: "Flooder",
    goal: "Overwhelm the site with a burst of rapid requests.",
    category: "api-flood",
    plan: ({ cap }) =>
      n(cap, () => ({
        method: "POST",
        path: "/api/transfer",
        headers: { "content-type": "application/json" },
        parallel: true,
        objective: true,
      })),
  },
  {
    id: "scanner",
    label: "Scanner",
    goal: "Walk many routes to find what is exposed.",
    category: "admin-scan",
    plan: ({ cap }) => {
      const routes = [
        "/wp-login.php",
        "/wp-admin/",
        "/xmlrpc.php",
        "/phpmyadmin/",
        "/administrator/",
        "/.git/config",
        "/backup.zip",
        "/server-status",
        "/config.php",
        "/api/health",
      ];
      return n(cap, (i) => ({
        method: "GET",
        path: routes[i % routes.length]!,
        gapMs: 25,
        objective: true,
      }));
    },
  },
  {
    id: "probe-agent",
    label: "Probe agent",
    goal: "An AI-agent-style client reading many pages at machine-even speed.",
    category: "ai-agent-crawl",
    plan: ({ cap }) =>
      n(cap, (i) => ({
        method: "GET",
        path: i === 0 ? "/" : `/statements/${2001 + i}`,
        gapMs: 15,
        objective: true,
      })),
  },
  {
    id: "trap-tripper",
    label: "Trap-tripper",
    goal: "Touch the honeypot and trap paths only a bot would find.",
    category: "trap-crawler",
    plan: ({ trapPath, cap }) => {
      const traps = [trapPath, "/.env", "/.aws/credentials", "/wp-admin/", "/.git/config"];
      return n(Math.min(cap, traps.length * 2), (i) => ({
        method: "GET",
        path: traps[i % traps.length]!,
        gapMs: 60,
        objective: true,
      }));
    },
  },
  {
    id: "harvester",
    label: "Harvester",
    goal: "Use the decoy credential the honeypots hand out to move money.",
    category: "leaked-key",
    plan: ({ cap }) => {
      const steps: AgentRequest[] = [
        { method: "GET", path: "/api/health", gapMs: 40 },
        { method: "GET", path: "/api/health", gapMs: 40, canary: true },
      ];
      // Repeated privileged calls with the decoy key; each is an objective request.
      for (let i = 0; i < Math.max(1, cap - 2); i++)
        steps.push({
          method: "POST",
          path: "/api/transfer",
          headers: { "content-type": "application/json" },
          gapMs: 40,
          canary: true,
          objective: true,
        });
      return steps;
    },
  },
];

/** Did the agent achieve its goal against this copy? Defined per agent, over the measured requests. */
export function goalReached(
  agentId: string,
  r: { sent: number; served: number; allowed: number; objectiveGotThrough: number },
): boolean {
  switch (agentId) {
    case "flooder":
      // Sustained throughput: most of the burst was answered.
      return r.served >= r.sent * 0.8;
    case "scanner":
    case "probe-agent":
      // Enumeration / crawling: most requests reached the app unimpeded.
      return r.allowed >= r.sent * 0.6;
    case "trap-tripper":
      // Tripped a trap without being caught: any objective request reached the app.
      return r.objectiveGotThrough >= 1;
    case "harvester":
      // The decoy credential actually moved money: a privileged call got through.
      return r.objectiveGotThrough >= 1;
    default:
      return r.allowed >= r.sent * 0.6;
  }
}
