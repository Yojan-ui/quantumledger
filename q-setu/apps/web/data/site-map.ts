/**
 * How the site hangs together: the nav's groups, and for each page its breadcrumb, a one-line
 * "what this page is for", and the logical next step (the path is Scan → Shield → Pricing → Early
 * access). Shared by the nav, the breadcrumbs and the "Next step" links. No React here.
 */
import { SOLUTIONS } from "./solutions";

export interface NavLink {
  href: string;
  label: string;
}

export interface NavGroup {
  id: "product" | "solutions" | "learn";
  label: string;
  items: NavLink[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "product",
    label: "Product",
    items: [
      { href: "/platform", label: "Platform" },
      { href: "/shield", label: "Shield" },
      { href: "/demo/scanner", label: "Scan" },
      { href: "/seal", label: "Seal" },
      { href: "/lab", label: "Lab" },
    ],
  },
  {
    id: "solutions",
    label: "Solutions",
    items: [
      { href: "/solutions", label: "Solutions" },
      ...SOLUTIONS.map((s) => ({ href: `/solutions/${s.id}`, label: s.name })),
    ],
  },
  {
    id: "learn",
    label: "Learn",
    items: [
      { href: "/demos", label: "Demos" },
      { href: "/docs", label: "Docs" },
      { href: "/readiness-index", label: "Readiness Index" },
      { href: "/security", label: "Security" },
      { href: "/changelog", label: "Changelog" },
      { href: "/about", label: "About" },
    ],
  },
];

export const PRICING_LINK: NavLink = { href: "/pricing", label: "Pricing" };

/** Is `path` this link's page (or one of its sub-pages)? */
export const isOn = (path: string, href: string) =>
  path === href || (href !== "/" && path.startsWith(`${href}/`));

/** The four steps every page leads towards, in order. */
const SCAN: NavLink = { href: "/demo/scanner", label: "Scan your website" };
const SHIELD: NavLink = { href: "/shield", label: "Protect it with Shield" };
const PRICING: NavLink = { href: "/pricing", label: "See pricing" };
const EARLY: NavLink = { href: "/#early-access", label: "Get early access" };

export interface PageInfo {
  /** Breadcrumb after "Home": the last item is this page (no link). */
  trail: { label: string; href?: string }[];
  purpose: string;
  next: NavLink;
}

const product = { label: "Product" };
const learn = { label: "Learn" };
const demos = { label: "Demos", href: "/demos" };

const DEMO_PAGES: Record<string, [string, string]> = {
  "how-it-works": [
    "How it works",
    "Shows a real post-quantum handshake between your browser and this server, step by step.",
  ],
  qday: [
    "Q-Day Time Machine",
    "Shows recorded traffic being broken at Q-Day, and which locks hold and which don't.",
  ],
  deploy: [
    "Deploy anywhere",
    "Shows an adapter being installed on a live node, and the check it passes.",
  ],
  ledger: [
    "Proof Chain",
    "Shows every operation signed into a chain anyone can check for tampering.",
  ],
};

export function pageInfo(path: string): PageInfo | undefined {
  const p = path.replace(/\/$/, "") || "/";
  switch (p) {
    case "/platform":
      return {
        trail: [product, { label: "Platform" }],
        purpose:
          "Shows the one crypto core and the five adapters that bring post-quantum security into your systems.",
        next: SCAN,
      };
    case "/shield":
      return {
        trail: [product, { label: "Shield" }],
        purpose:
          "Explains how Shield sits in front of your site and makes it quantum-safe with one DNS change.",
        next: PRICING,
      };
    case "/shield/live":
      return {
        trail: [product, { label: "Shield", href: "/shield" }, { label: "Live" }],
        purpose:
          "Runs real attacks on an app with and without Shield in front, so you can compare what each attacker got.",
        next: PRICING,
      };
    case "/demo/scanner":
      return {
        trail: [product, { label: "Scan" }],
        purpose:
          "Checks a website, config, certificate or code for quantum risk and tells you what to fix first.",
        next: SHIELD,
      };
    case "/seal":
      return {
        trail: [product, { label: "Seal" }],
        purpose: "Runs a post-quantum handshake on your own device and shows how long it took.",
        next: SCAN,
      };
    case "/solutions":
      return {
        trail: [{ label: "Solutions" }],
        purpose: "Shows what QuantumLedger protects in each sector, and why it matters there.",
        next: SCAN,
      };
    case "/demos":
      return {
        trail: [learn, { label: "Demos" }],
        purpose:
          "Lists the live demos: real cryptography running in your browser or on this server.",
        next: SCAN,
      };
    case "/docs":
      return {
        trail: [learn, { label: "Docs" }],
        purpose: "Explains how to install and use each adapter.",
        next: SCAN,
      };
    case "/readiness-index":
      return {
        trail: [learn, { label: "Readiness Index" }],
        purpose:
          "Shows how ready India's public websites are for quantum computers, sector by sector.",
        next: SCAN,
      };
    case "/security":
      return {
        trail: [learn, { label: "Security" }],
        purpose: "Says what QuantumLedger protects, what it doesn't, and what is simulated.",
        next: SCAN,
      };
    case "/changelog":
      return {
        trail: [learn, { label: "Changelog" }],
        purpose: "Lists what changed in each release.",
        next: SCAN,
      };
    case "/about":
      return {
        trail: [learn, { label: "About" }],
        purpose: "Explains who is building QuantumLedger, and why now.",
        next: SCAN,
      };
    case "/pricing":
      return {
        trail: [{ label: "Pricing" }],
        purpose: "Compares the tiers: the same cryptography in each, with a different operator.",
        next: EARLY,
      };
    case "/contact":
      return {
        trail: [{ label: "Contact" }],
        purpose: "Tells you how to reach the team about pilots, pricing or security.",
        next: EARLY,
      };
    case "/privacy":
      return {
        trail: [{ label: "Privacy" }],
        purpose: "Says what data the site collects and what it does with it.",
        next: SCAN,
      };
    case "/terms":
      return {
        trail: [{ label: "Terms" }],
        purpose: "Sets out the terms for using this early product.",
        next: SCAN,
      };
  }
  const sol = p.match(/^\/solutions\/([^/]+)$/);
  const s = sol && SOLUTIONS.find((x) => x.id === sol[1]);
  if (s)
    return {
      trail: [{ label: "Solutions", href: "/solutions" }, { label: s.name }],
      purpose: `Shows where post-quantum protection fits in ${s.name.toLowerCase()}, and what it guards.`,
      next: SCAN,
    };
  const demo = p.match(/^\/demo\/([^/]+)$/);
  const d = demo && DEMO_PAGES[demo[1]!];
  if (d) return { trail: [learn, demos, { label: d[0] }], purpose: d[1], next: SCAN };
  const scan = p.match(/^\/scan\/([^/]+)$/);
  if (scan)
    return {
      trail: [
        product,
        { label: "Scan", href: "/demo/scanner" },
        { label: decodeURIComponent(scan[1]!) },
      ],
      purpose: "Shows one website's quantum-readiness result and what to fix first.",
      next: SHIELD,
    };
  if (p.startsWith("/docs/"))
    return {
      trail: [learn, { label: "Docs", href: "/docs" }],
      purpose: "Explains how to install and use each adapter.",
      next: SCAN,
    };
  return undefined;
}
