/**
 * Test traffic: a handful of scripted, clearly labelled attacker behaviours sent to the LOCAL
 * protected sandbox, so the lab has something to record in development. Every request carries the
 * synthetic header (records are marked synthetic), comes from a documentation-range address
 * (RFC 5737) via X-Forwarded-For, and passes the host guard: none of it can leave this machine.
 * One scenario is an ordinary visitor, to show that normal browsing isn't recorded.
 */
import { sandboxUrl } from "./hostguard";
import { SYNTHETIC_HEADER } from "./detect";

type Req = { method?: string; path: string; headers?: Record<string, string>; gapMs?: number };

export interface Scenario {
  id: string;
  label: string;
  ua?: string;
  requests(ctx: { canaryKey: string; trapPath: string }): Req[];
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

export const SCENARIOS: Scenario[] = [
  {
    id: "secrets-probe",
    label: "Secrets probe (curl)",
    ua: "curl/8.7.1",
    requests: () =>
      ["/", "/robots.txt", "/.env", "/.git/config", "/.aws/credentials", "/backup.zip", "/"].map(
        (path) => ({ path, gapMs: 120 }),
      ),
  },
  {
    id: "admin-scan",
    label: "CMS admin scan (python-requests)",
    ua: "python-requests/2.32.3",
    requests: () =>
      ["/wp-login.php", "/wp-admin/", "/xmlrpc.php", "/phpmyadmin/", "/api/health"].map((path) => ({
        path,
        gapMs: 80,
      })),
  },
  {
    id: "api-flood",
    label: "API flood (Go client)",
    ua: "Go-http-client/1.1",
    requests: () =>
      range(70).map(() => ({
        method: "POST",
        path: "/api/transfer",
        headers: { "content-type": "application/json" },
        gapMs: 5,
      })),
  },
  {
    id: "ai-crawl",
    label: "AI-agent crawl (GPTBot)",
    ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
    requests: () => [
      { path: "/", gapMs: 30 },
      ...range(55).map((i) => ({ path: `/statements/${2001 + i}`, gapMs: 15 })),
    ],
  },
  {
    id: "fake-googlebot",
    label: "Fake Googlebot",
    ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    requests: () => ["/", "/api/health", "/"].map((path) => ({ path, gapMs: 200 })),
  },
  {
    id: "leaked-key",
    label: "Leaked API key use",
    ua: "node-fetch/1.0",
    requests: ({ canaryKey }) => [
      { path: "/api/health", gapMs: 50 },
      { path: "/api/health", headers: { "x-api-key": canaryKey }, gapMs: 50 },
      { method: "POST", path: "/api/transfer", headers: { "x-api-key": canaryKey }, gapMs: 50 },
    ],
  },
  {
    id: "trap-crawler",
    label: "Hidden-link crawler (headless)",
    ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0.0.0 Safari/537.36",
    requests: ({ trapPath }) => [
      { path: "/", gapMs: 100 },
      { path: trapPath, gapMs: 100 },
      { path: "/", gapMs: 100 },
    ],
  },
  {
    id: "ordinary-visitor",
    label: "Ordinary visitor (should not be recorded)",
    ua: CHROME,
    // A person: a handful of pages with uneven pauses.
    requests: () =>
      [
        ["/", 0],
        ["/api/health", 1700],
        ["/", 650],
        ["/", 2300],
        ["/api/health", 900],
      ].map(([path, gapMs]) => ({
        path: path as string,
        gapMs: gapMs as number,
        headers: {
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-IN,en;q=0.9",
          "sec-fetch-mode": "navigate",
        },
      })),
  },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const docIp = () =>
  `${Math.random() < 0.5 ? "203.0.113" : "192.0.2"}.${1 + Math.floor(Math.random() * 254)}`;

/** Which demo site a request is for, when one sandbox stands in for several customers. */
export const SITE_HEADER = "x-attack-lab-site";

/**
 * Runs the scenarios (all by default) in parallel against the protected sandbox. With `sites`, the
 * scenarios are dealt round-robin across them, so each demo customer gets some.
 */
export async function simulate(
  target: string,
  ctx: { canaryKey: string; trapPath: string },
  ids?: string[],
  sites: string[] = [],
): Promise<{ scenario: string; site?: string; sent: number; statuses: Record<number, number> }[]> {
  const chosen = SCENARIOS.filter((s) => !ids?.length || ids.includes(s.id));
  return Promise.all(
    chosen.map(async (s, n) => {
      const site = sites.length ? sites[n % sites.length] : undefined;
      const ip = docIp();
      const statuses: Record<number, number> = {};
      let sent = 0;
      for (const r of s.requests(ctx)) {
        if (r.gapMs) await wait(r.gapMs);
        const method = r.method ?? "GET";
        try {
          const res = await fetch(sandboxUrl(target, r.path), {
            method,
            redirect: "manual",
            signal: AbortSignal.timeout(15_000),
            headers: {
              "x-forwarded-for": ip,
              [SYNTHETIC_HEADER]: "1",
              ...(site ? { [SITE_HEADER]: site } : {}),
              accept: "*/*",
              ...(s.ua ? { "user-agent": s.ua } : {}),
              ...r.headers,
            },
            ...(method === "POST" ? { body: "{}" } : {}),
          });
          await res.arrayBuffer();
          statuses[res.status] = (statuses[res.status] ?? 0) + 1;
        } catch {
          statuses[0] = (statuses[0] ?? 0) + 1;
        }
        sent++;
      }
      return { scenario: s.id, ...(site ? { site } : {}), sent, statuses };
    }),
  );
}
