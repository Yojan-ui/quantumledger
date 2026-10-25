/**
 * Pattern: incidents that look alike, grouped under a plain name. The rules are deliberately simple
 * and explainable (each one names the evidence it keys on), and checked in order, so an incident
 * lands in the most specific pattern that fits. A rule-based grouping misses novel shapes: those
 * fall through to "Other automated abuse" and are worth a person's look.
 */
import { routeClass } from "./privacy";
import type { EventRecord, Incident, Pattern } from "./types";

interface Features {
  types: Set<string>;
  signals: string[];
  classes: Set<string>;
  clients: Set<string>;
  apiWrites: number;
  distinctRoutes: number;
}

interface Rule {
  id: string;
  name: string;
  description: string;
  test(f: Features): boolean;
}

const has = (f: Features, re: RegExp) => f.signals.some((s) => re.test(s));

export const RULES: Rule[] = [
  {
    id: "leaked-key",
    name: "Leaked-key use",
    description: "Used a canary API key, planted where only a scraper or a leak would find it.",
    test: (f) => f.types.has("canary"),
  },
  {
    id: "search-impersonation",
    name: "Search-engine impersonation",
    description: "Claimed to be a search engine; reverse and forward DNS disagreed.",
    test: (f) => f.types.has("bot_impersonation"),
  },
  {
    id: "secrets-probe",
    name: "Secrets probe",
    description: "Asked for files that hold secrets: .env, .git, cloud credentials, backups.",
    test: (f) => f.classes.has("secrets"),
  },
  {
    id: "admin-scan",
    name: "Admin and CMS scan",
    description: "Walked known admin and CMS login paths on a site that has none.",
    test: (f) => f.classes.has("admin"),
  },
  {
    id: "trap-crawler",
    name: "Hidden-link crawler",
    description: "Followed the invisible trap link that only automated crawlers see.",
    test: (f) => f.types.has("trap") || f.classes.has("trap"),
  },
  {
    id: "ai-agent-crawl",
    name: "AI-agent crawl",
    description: "An AI crawler or agent walking many routes faster than a person.",
    test: (f) => f.clients.has("ai-agent"),
  },
  {
    id: "api-flood",
    name: "API flood",
    description: "Many write calls to the API in a short burst.",
    test: (f) => f.apiWrites >= 10 || (f.classes.has("api") && has(f, /rate|burst/)),
  },
  {
    id: "route-enumeration",
    name: "Route enumeration",
    description: "Tried many different routes, most of which don't exist.",
    test: (f) => has(f, /routes|requests fail/) || f.distinctRoutes >= 20,
  },
  {
    id: "other",
    name: "Other automated abuse",
    description: "Flagged by Shield, but matches none of the named patterns. Worth a look.",
    test: () => true,
  },
];

function features(inc: Incident, events: EventRecord[]): Features {
  const routes = new Set(events.map((e) => e.body.route));
  return {
    types: new Set(inc.types),
    signals: inc.signals,
    classes: new Set([...routes].map((r) => routeClass(r))),
    clients: new Set(inc.clients),
    apiWrites: events.filter((e) => e.body.method !== "GET" && e.body.route.startsWith("/api/"))
      .length,
    distinctRoutes: routes.size,
  };
}

export function classify(inc: Incident, events: EventRecord[]): Rule {
  const f = features(inc, events);
  return RULES.find((r) => r.test(f))!;
}

export function groupPatterns(
  incidents: Incident[],
  eventsOf: (id: string) => EventRecord[],
): Pattern[] {
  const out = new Map<string, Pattern & { routes: Map<string, number> }>();
  for (const inc of incidents) {
    const events = eventsOf(inc.id);
    const rule = classify(inc, events);
    let p = out.get(rule.id);
    if (!p) {
      p = {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        count: 0,
        firstSeen: inc.opened,
        lastSeen: inc.lastSeen,
        incidentIds: [],
        topRoutes: [],
        clients: [],
        routes: new Map(),
      };
      out.set(rule.id, p);
    }
    p.count++;
    p.firstSeen = Math.min(p.firstSeen, inc.opened);
    p.lastSeen = Math.max(p.lastSeen, inc.lastSeen);
    p.incidentIds.push(inc.id);
    for (const c of inc.clients) if (!p.clients.includes(c)) p.clients.push(c);
    for (const e of events) p.routes.set(e.body.route, (p.routes.get(e.body.route) ?? 0) + 1);
  }
  return [...out.values()]
    .map(({ routes, ...p }) => ({
      ...p,
      topRoutes: [...routes.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([route, n]) => ({ route, n })),
    }))
    .sort((a, b) => b.lastSeen - a.lastSeen);
}
