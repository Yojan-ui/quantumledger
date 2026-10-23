/**
 * The AI-agent and abuse defence engine. It watches behaviour, not signatures: how fast a client
 * asks, how many different routes it walks, how many of its requests fail, how many it sends at
 * once, whether its headers and TLS fingerprint agree with the browser it claims to be, and whether
 * it has run JavaScript. It keeps those per IP, per network block (/24 for IPv4, /48 for IPv6) and per
 * session, and turns the worst of them into a risk score from 0 to 100.
 *
 * The score is acted on in steps: allow → a tighter rate limit → a proof-of-work challenge → a
 * temporary block, with longer blocks for repeat offenders. Honeypot routes, the hidden trap link and
 * the site's canary API key skip the steps: anyone touching them is blocked and an alert goes out.
 * Search engines that prove who they are (reverse and forward DNS) are allowed.
 *
 * Modes: off (nothing), monitor (score and report, never act: every new site starts here),
 * protect (the steps above), strict (the same steps at lower scores).
 *
 * What it can't do: it has no ASN data unless you pass a lookup, it sees JA4 only behind Shield
 * Edge (a middleware never sees the TLS handshake), and a careful human-speed agent running a real
 * browser will look like a person. It raises the cost of abuse and makes it noisy; it doesn't make
 * a site impossible to attack.
 */
import { promises as dns } from "node:dns";
import {
  challengePage,
  issueChallenge,
  PASS_COOKIE,
  PASS_TTL_MS,
  POW_PATH,
  validPass,
  verifySolution,
} from "./pow";
import { DistinctWindow, Lru, Window } from "./windows";

export type Mode = "off" | "monitor" | "protect" | "strict";
export type Action = "allow" | "limit" | "challenge" | "block";

export const DEFAULT_HONEYPOTS = [
  "/.env",
  "/wp-login.php",
  "/wp-admin/",
  "/.git/config",
  "/backup.zip",
  "/xmlrpc.php",
  "/phpmyadmin/",
  "/.aws/credentials",
  "/server-status",
];

export interface GuardConfig {
  mode: Mode;
  /** ≥ 32 characters; signs challenges and pass cookies. */
  secret: string;
  /** Paths that no real visitor requests. Add "/admin" only if the site has no real /admin. */
  honeypots?: string[];
  /** The hidden trap link's path (linked invisibly in pages; only crawlers follow it). */
  trapPath?: string;
  /** Fake API keys planted where only a scraper would find them; any use is an alert. */
  canaryKeys?: string[];
  /** Paths never challenged or limited by behaviour (webhooks, health checks). Honeypots still apply. */
  exempt?: RegExp[];
  /** Proof-of-work difficulty in leading zero bits (default 16). */
  powBits?: number;
  /** Optional: IP → ASN, to add a per-network-operator view. Not bundled (it needs a data source). */
  asnOf?: (ip: string) => string | undefined;
  onEvent?: (e: GuardEvent) => void;
  now?: () => number;
  /** For tests: DNS for verifying search-engine bots. */
  reverse?: (ip: string) => Promise<string[]>;
  lookup?: (host: string) => Promise<string[]>;
}

export interface RequestInfo {
  ip: string;
  method: string;
  /** Path and query, as received. */
  path: string;
  headers: Record<string, string | string[] | undefined>;
  /** From Shield Edge only: the TLS ClientHello's fingerprint, version and ALPN offer. */
  tls?: { ja4?: string; version?: number; alpn?: string[] };
}

export interface Decision {
  action: Action;
  score: number;
  reasons: string[];
  /** What to send instead of the page, when action isn't "allow" (and mode isn't monitor). */
  response?: { status: number; headers: Record<string, string>; body: string; delayMs?: number };
  /** True in monitor mode when the engine would have acted. */
  wouldAct?: boolean;
}

export interface GuardEvent {
  type:
    | "limit"
    | "challenge"
    | "block"
    | "honeypot"
    | "trap"
    | "canary"
    | "challenge_passed"
    | "bot_verified"
    | "bot_impersonation";
  at: number;
  ip: string;
  path: string;
  score: number;
  reasons: string[];
  monitorOnly: boolean;
}

const THRESHOLDS: Record<
  "protect" | "strict",
  { limit: number; challenge: number; block: number }
> = {
  protect: { limit: 30, challenge: 60, block: 80 },
  strict: { limit: 20, challenge: 40, block: 65 },
};
const BLOCK_BASE_MS = 5 * 60_000;
const BLOCK_MAX_MS = 24 * 3_600_000;
const MAX_KEYS = 100_000;

/** Search engines that publish how to verify them by DNS. */
const GOOD_BOTS: { ua: RegExp; domains: string[] }[] = [
  {
    ua: /Googlebot|AdsBot-Google|Google-InspectionTool/i,
    domains: [".googlebot.com", ".google.com", ".googleusercontent.com"],
  },
  { ua: /bingbot|BingPreview/i, domains: [".search.msn.com"] },
  { ua: /DuckDuckBot/i, domains: [".duckduckgo.com"] },
  { ua: /Applebot/i, domains: [".applebot.apple.com"] },
];
const TOOL_UA =
  /\b(curl|wget|python-requests|python-urllib|aiohttp|httpx|Go-http-client|node-fetch|axios|okhttp|libwww-perl|Scrapy|HeadlessChrome|PhantomJS|Playwright|Puppeteer|GPTBot|ClaudeBot|CCBot|Bytespider|PerplexityBot)\b/i;
const BROWSER_UA = /Mozilla\/5\.0 .*(Chrome|Firefox|Safari|Edg)\//;

const one = (h: string | string[] | undefined) => (Array.isArray(h) ? h[0] : h) ?? "";

/** /24 for IPv4, /48 for IPv6: one subscriber or small provider block. */
export function netOf(ip: string): string {
  if (ip.includes(".") && !ip.includes(":")) return ip.split(".").slice(0, 3).join(".") + ".0/24";
  const v4 = ip.match(/::ffff:(\d+\.\d+\.\d+)\.\d+$/i);
  if (v4) return `${v4[1]}.0/24`;
  const parts = ip.split(":");
  return parts.slice(0, 3).join(":") + "::/48";
}

function cookie(headers: RequestInfo["headers"], name: string): string | undefined {
  const raw = one(headers.cookie);
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

interface Stats {
  rate10: Window;
  rate60: Window;
  errors60: Window;
  paths60: DistinctWindow;
  inflight: number;
}
const newStats = (): Stats => ({
  rate10: new Window(10_000),
  rate60: new Window(60_000),
  errors60: new Window(60_000),
  paths60: new DistinctWindow(60_000),
  inflight: 0,
});

export class Guard {
  private readonly stats = new Lru<string, Stats>(MAX_KEYS);
  private readonly offenders = new Lru<string, { strikes: number; until: number }>(MAX_KEYS);
  private readonly limiter = new Lru<string, Window>(MAX_KEYS);
  private readonly bots = new Lru<string, { ok: boolean; at: number }>(10_000);
  private readonly honeypots: Set<string>;
  private readonly now: () => number;
  mode: Mode;

  constructor(private readonly cfg: GuardConfig) {
    if (!cfg.secret || cfg.secret.length < 32)
      throw new Error("Guard secret must be at least 32 characters");
    this.mode = cfg.mode;
    this.now = cfg.now ?? Date.now;
    this.honeypots = new Set((cfg.honeypots ?? DEFAULT_HONEYPOTS).map((p) => p.toLowerCase()));
  }

  /** Emergency switch and mode changes: takes effect on the next request. */
  setMode(m: Mode) {
    this.mode = m;
  }

  private keys(req: RequestInfo): string[] {
    const k = [`ip:${req.ip}`, `net:${netOf(req.ip)}`];
    const asn = this.cfg.asnOf?.(req.ip);
    if (asn) k.push(`asn:${asn}`);
    const sid = cookie(req.headers, PASS_COOKIE);
    if (sid) k.push(`pass:${sid.slice(0, 24)}`);
    return k;
  }

  private statsFor(key: string): Stats {
    let s = this.stats.get(key);
    if (!s) this.stats.set(key, (s = newStats()));
    return s;
  }

  private emit(type: GuardEvent["type"], req: RequestInfo, score: number, reasons: string[]) {
    this.cfg.onEvent?.({
      type,
      at: this.now(),
      ip: req.ip,
      path: req.path.slice(0, 200),
      score,
      reasons,
      monitorOnly: this.mode === "monitor",
    });
  }

  private async verifiedBot(req: RequestInfo, ua: string): Promise<boolean | undefined> {
    const bot = GOOD_BOTS.find((b) => b.ua.test(ua));
    if (!bot) return undefined;
    const cached = this.bots.get(req.ip);
    if (cached && this.now() - cached.at < 86_400_000) return cached.ok;
    let ok = false;
    try {
      const reverse = this.cfg.reverse ?? dns.reverse;
      const lookup =
        this.cfg.lookup ??
        (async (h: string) => (await dns.lookup(h, { all: true })).map((a) => a.address));
      for (const host of (await reverse(req.ip)).slice(0, 3)) {
        if (!bot.domains.some((d) => host.toLowerCase().endsWith(d))) continue;
        if ((await lookup(host)).includes(req.ip)) {
          ok = true;
          break;
        }
      }
    } catch {
      ok = false;
    }
    this.bots.set(req.ip, { ok, at: this.now() });
    return ok;
  }

  /** Scores a request and decides. Call `finish()` with the response status afterwards. */
  async check(req: RequestInfo): Promise<Decision> {
    if (this.mode === "off") return { action: "allow", score: 0, reasons: [] };
    const now = this.now();
    const path = req.path.split("?")[0]!.toLowerCase();
    const reasons: string[] = [];
    let score = 0;
    const keys = this.keys(req);
    for (const k of keys) this.statsFor(k).inflight++;

    // The challenge endpoint answers itself.
    if (path === POW_PATH) return { action: "allow", score: 0, reasons: ["pow endpoint"] };

    // Tripwires first: no real visitor ever does these.
    const trap = this.cfg.trapPath && path === this.cfg.trapPath.toLowerCase();
    const honeypot =
      this.honeypots.has(path) ||
      [...this.honeypots].some((h) => h.endsWith("/") && path.startsWith(h));
    const canary = this.cfg.canaryKeys?.some(
      (k) =>
        k && (req.path.includes(k) || Object.values(req.headers).some((v) => one(v).includes(k))),
    );
    if (trap || honeypot || canary) {
      const type = canary ? "canary" : trap ? "trap" : "honeypot";
      reasons.push(type);
      this.strike(req.ip, now);
      this.emit(type, req, 100, reasons);
      // Boring and slow: a plain 404 after a pause, as if nothing were there.
      return this.act(
        { action: "block", score: 100, reasons },
        {
          status: 404,
          headers: { "content-type": "text/plain; charset=utf-8" },
          body: "Not found\n",
          delayMs: 3000,
        },
      );
    }

    // An existing block stands until it expires.
    const off = this.offenders.get(`ip:${req.ip}`);
    if (off && off.until > now) {
      return this.act(
        { action: "block", score: 100, reasons: ["blocked earlier"] },
        this.forbidden(),
      );
    }

    const ua = one(req.headers["user-agent"]);
    const bot = await this.verifiedBot(req, ua);
    if (bot === true) {
      this.emit("bot_verified", req, 0, ["verified search engine"]);
      return { action: "allow", score: 0, reasons: ["verified search engine"] };
    }
    if (bot === false) {
      score += 40;
      reasons.push("claims to be a search engine, DNS disagrees");
      this.emit("bot_impersonation", req, score, reasons);
    }

    // Behaviour: the worst of IP, network block, ASN and pass cookie.
    let behaviour = 0;
    const why = new Set<string>();
    for (const k of keys) {
      const s = this.statsFor(k);
      const isNet = k.startsWith("net:") || k.startsWith("asn:");
      // A network block carries many people: it needs much more to count against it.
      const f = isNet ? 8 : 1;
      let b = 0;
      const add = (n: number, reason: string) => {
        b += n;
        why.add(reason);
      };
      const r10 = s.rate10.add(now);
      const r60 = s.rate60.add(now);
      if (r10 > 150 * f) add(45, "very high request rate");
      else if (r10 > 50 * f) add(25, "high request rate");
      else if (r10 > 20 * f) add(10, "fast requests");
      const distinct = s.paths60.add(now, path);
      if (!isNet) {
        if (distinct > 120) add(30, "walking many routes");
        else if (distinct > 40) add(15, "many distinct routes");
      }
      const errs = s.errors60.total(now);
      if (r60 >= 20 && errs / r60 > 0.6) add(30, "most requests fail");
      else if (r60 >= 20 && errs / r60 > 0.3) add(15, "many requests fail");
      if (s.inflight > 60 * f) add(30, "large parallel burst");
      else if (s.inflight > 20 * f) add(15, "parallel burst");
      behaviour = Math.max(behaviour, b);
    }
    score += behaviour;
    reasons.push(...why);

    const flag = (n: number, reason: string) => {
      score += n;
      reasons.push(reason);
    };
    // Headers that don't fit the browser claimed.
    if (!ua) flag(20, "no user agent");
    else if (TOOL_UA.test(ua)) flag(20, "automation user agent");
    else if (BROWSER_UA.test(ua)) {
      if (!req.headers["accept-language"]) flag(10, "browser without accept-language");
      const nav = one(req.headers.accept).includes("text/html");
      const modern = /Chrome\/(1[0-9]{2})|Firefox\/(1[0-9]{2})/.test(ua);
      if (nav && modern && !req.headers["sec-fetch-mode"])
        flag(10, "modern browser without fetch metadata");
      if (req.tls) {
        if (req.tls.version !== undefined && req.tls.version < 0x0304)
          flag(10, "browser on old TLS");
        if (req.tls.alpn && !req.tls.alpn.includes("h2")) flag(15, "browser UA, non-browser TLS");
      }
    }

    // Has run JavaScript and solved a challenge recently: much more likely a person.
    if (validPass(this.cfg.secret, req.ip, cookie(req.headers, PASS_COOKIE), now))
      flag(-30, "passed a challenge");

    score = Math.max(0, Math.min(100, score));
    if (this.cfg.exempt?.some((r) => r.test(path)))
      return { action: "allow", score, reasons: [...reasons, "exempt path"] };
    return this.ladder(req, score, reasons, now);
  }

  /** Records the outcome (for the error ratio) and ends the in-flight count. */
  finish(req: RequestInfo, status: number) {
    const now = this.now();
    for (const k of this.keys(req)) {
      const s = this.stats.get(k);
      if (!s) continue;
      s.inflight = Math.max(0, s.inflight - 1);
      if (status === 401 || status === 403 || status === 404 || status === 405 || status >= 500)
        s.errors60.add(now);
    }
  }

  /** Handles a POST to the challenge endpoint; returns the response to send. */
  solve(
    req: RequestInfo,
    body: string,
  ): { status: number; headers: Record<string, string>; body: string } {
    let c = "";
    let n = "";
    try {
      ({ c, n } = JSON.parse(body.slice(0, 2048)) as { c: string; n: string });
    } catch {
      /* falls through to 400 */
    }
    const pass =
      typeof c === "string" && typeof n === "string"
        ? verifySolution(this.cfg.secret, req.ip, c, n, this.now())
        : undefined;
    if (!pass)
      return {
        status: 400,
        headers: { "content-type": "text/plain; charset=utf-8" },
        body: "Bad request\n",
      };
    this.emit("challenge_passed", req, 0, []);
    return {
      status: 204,
      headers: {
        "set-cookie": `${PASS_COOKIE}=${pass}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${PASS_TTL_MS / 1000}`,
      },
      body: "",
    };
  }

  private ladder(req: RequestInfo, score: number, reasons: string[], now: number): Decision {
    const t = THRESHOLDS[this.mode === "strict" ? "strict" : "protect"];
    if (score >= t.block) {
      this.strike(req.ip, now);
      this.emit("block", req, score, reasons);
      return this.act({ action: "block", score, reasons }, this.forbidden());
    }
    if (score >= t.challenge) {
      const html =
        one(req.headers.accept).includes("text/html") &&
        (req.method === "GET" || req.method === "HEAD");
      this.emit("challenge", req, score, reasons);
      if (html) {
        const page = challengePage(
          issueChallenge(this.cfg.secret, req.ip, this.cfg.powBits ?? 16, now),
          req.path,
        );
        return this.act(
          { action: "challenge", score, reasons },
          {
            status: 403,
            headers: {
              "content-type": "text/html; charset=utf-8",
              "content-security-policy": page.csp,
              "cache-control": "no-store",
            },
            body: page.html,
          },
        );
      }
      // An API call can't solve a page: slow it right down instead.
      return this.limitTo(req, score, reasons, now, 1);
    }
    if (score >= t.limit) return this.limitTo(req, score, reasons, now, 10);
    return { action: "allow", score, reasons };
  }

  /** At most `perTenSeconds` requests per 10 s for this IP while its score stays up. */
  private limitTo(
    req: RequestInfo,
    score: number,
    reasons: string[],
    now: number,
    perTenSeconds: number,
  ): Decision {
    let w = this.limiter.get(req.ip);
    if (!w) this.limiter.set(req.ip, (w = new Window(10_000)));
    if (w.add(now) <= perTenSeconds)
      return { action: "allow", score, reasons: [...reasons, "within tighter limit"] };
    this.emit("limit", req, score, reasons);
    return this.act(
      { action: "limit", score, reasons },
      {
        status: 429,
        headers: { "content-type": "text/plain; charset=utf-8", "retry-after": "10" },
        body: "Too many requests\n",
      },
    );
  }

  private strike(ip: string, now: number) {
    const prev = this.offenders.get(`ip:${ip}`);
    const strikes = (prev?.strikes ?? 0) + 1;
    const ms = Math.min(BLOCK_MAX_MS, BLOCK_BASE_MS * 4 ** (strikes - 1));
    this.offenders.set(`ip:${ip}`, { strikes, until: now + ms });
  }

  private forbidden() {
    return {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
      body: "Forbidden\n",
    };
  }

  /** In monitor mode, report what would have happened but let the request through. */
  private act(d: Decision, response: NonNullable<Decision["response"]>): Decision {
    if (this.mode === "monitor") return { ...d, action: "allow", wouldAct: true };
    return { ...d, response };
  }
}
