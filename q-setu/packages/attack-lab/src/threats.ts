/**
 * Real AI-agent attacks in the news, as plain summaries: what happened, what a defender would have
 * seen, and which of the threat model's features look for that behaviour. No exploit detail. Each
 * entry links the reporting it comes from; figures are as reported, several are estimates.
 *
 * The Lab's practice traffic is labelled with the entry it imitates (`patterns`), so the demo maps
 * to real events. The practice traffic is a small, safe imitation of the behaviour, nothing more.
 */
import type { FeatureName } from "./model/features";

export interface Threat {
  id: string;
  /** Month of the incident or report (YYYY-MM). */
  date: string;
  title: string;
  /** One line: what happened. */
  summary: string;
  /** What a defender would see in their traffic. */
  seen: string[];
  /** The model features that look for that behaviour. */
  features: FeatureName[];
  /** One line: how the threat model would spot it. */
  spot: string;
  /** Lab patterns whose practice traffic imitates this behaviour. */
  patterns: string[];
  sources: { label: string; url: string }[];
}

export const THREATS: Threat[] = [
  {
    id: "agent-swarm-100-breaches",
    date: "2026-10",
    title: "AI agents probed 1,200+ sites and breached about 100 companies",
    summary:
      "One operator's autonomous agents tried more than 1,200 websites and broke into about 100, at an estimated $50 in AI costs per breach.",
    seen: [
      "many different routes probed quickly from one source",
      "requests at machine-even intervals, around the clock",
      "a spike of errors as guesses miss",
    ],
    features: ["distinctRoutes", "timingEvenness", "errorRatio", "requestRate"],
    spot: "It walks many routes fast and evenly, and most of its guesses fail: all four are features the model weighs.",
    patterns: ["secrets-probe", "admin-scan", "route-enumeration"],
    sources: [
      {
        label: "The Next Web (on Reuters / NorForge), Oct 2026",
        url: "https://thenextweb.com/news/ai-agents-hacker-cairn-100-sites-deere-norforge",
      },
      {
        label: "Fortune, Oct 2026",
        url: "https://fortune.com/2026/10/21/powerful-new-ai-models-are-powering-a-growing-wave-of-cyber-attacks-experts-say/",
      },
    ],
  },
  {
    id: "hugging-face-agent-attack",
    date: "2026-07",
    title: "Autonomous AI agents attacked Hugging Face",
    summary:
      "Hugging Face reported a fully autonomous AI agent swarming its systems with tens of thousands of automated actions; OpenAI later said its own test agents were responsible.",
    seen: [
      "tens of thousands of automated actions",
      "agent-like timing with no human pauses",
      "an automation client, not a browser",
    ],
    features: ["requestRate", "timingEvenness", "automationClient", "fastBurst"],
    spot: "Swarms of automated actions arrive faster and more evenly than any person, from clients that never pass a browser check.",
    patterns: ["ai-agent-crawl", "trap-crawler"],
    sources: [
      {
        label: "Fortune, Jul 2026",
        url: "https://fortune.com/2026/07/20/hugging-face-turns-to-chinese-open-source-ai-to-fend-off-autonomous-ai-cyber-attack-after-american-ai-guardrails-stymie-defense/",
      },
      {
        label: "Fortune, Jul 2026 (OpenAI's account)",
        url: "https://fortune.com/2026/07/21/openai-says-ai-models-escaped-control-hacked-hugging-face/",
      },
    ],
  },
  {
    id: "opencode-48h",
    date: "2026-10",
    title: "OpenCode under relentless automated attack for 48 hours",
    summary:
      "The OpenCode platform faced 48 hours of AI-driven attacks; the company said 1.4% of its users were affected and stored third-party API keys may have been exposed.",
    seen: [
      "a sustained flood of requests to the API",
      "stolen API keys being used",
      "the same calls repeated at high speed",
    ],
    features: ["apiWrites", "requestRate", "canaryTouched", "fastBurst"],
    spot: "A flood of API writes and any use of a planted bait key are both strong signals in the model.",
    patterns: ["api-flood", "leaked-key"],
    sources: [
      {
        label: "Fortune, Oct 2026",
        url: "https://fortune.com/2026/10/21/powerful-new-ai-models-are-powering-a-growing-wave-of-cyber-attacks-experts-say/",
      },
      {
        label: "BleepingComputer, Oct 2026",
        url: "https://www.bleepingcomputer.com/news/security/opencode-hack-exposes-api-keys-amid-ai-distillation-attacks/",
      },
    ],
  },
  {
    id: "ai-orchestrated-espionage",
    date: "2025-11",
    title: "The first reported AI-orchestrated espionage campaign",
    summary:
      "Anthropic reported a state-sponsored group using AI agents for 80–90% of the tactical work against about 30 organisations, succeeding in a small number of cases.",
    seen: [
      "reconnaissance of admin and login pages",
      "requests that disguise themselves as legitimate tools",
      "headers that don't match the client claimed",
    ],
    features: ["sensitiveRoutes", "headerMismatch", "automationClient", "honeypotTouched"],
    spot: "Reconnaissance of sensitive paths, and headers that contradict the claimed client, are what the model flags.",
    patterns: ["search-impersonation", "admin-scan"],
    sources: [
      {
        label: "Anthropic, Nov 2025 (report)",
        url: "https://assets.anthropic.com/m/ec212e6566a0d47/original/Disrupting-the-first-reported-AI-orchestrated-cyber-espionage-campaign.pdf",
      },
    ],
  },
];

/** The news entry a Lab pattern's practice traffic imitates, if any. */
export function threatForPattern(pattern: string): Threat | undefined {
  return THREATS.find((t) => t.patterns.includes(pattern));
}
