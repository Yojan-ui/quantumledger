/**
 * The attack map's data shape and colour table, kept free of three.js so the page and its legend
 * can use them without loading the 3D (./AttackMap loads on its own, later).
 */
export interface MapIncident {
  id: string;
  pattern: string;
  /** Steps Shield let through, then steps it refused (in that order, as attacks usually run). */
  allowed: number;
  refused: number;
}

export type Tone = "danger" | "warn" | "sig" | "text3";
/** Pattern → role colour (the legend under the map uses the same table). */
export const PATTERN_TONE: Record<string, Tone> = {
  "secrets-probe": "danger",
  "leaked-key": "danger",
  "api-flood": "danger",
  "admin-scan": "warn",
  "route-enumeration": "warn",
  "search-impersonation": "warn",
  "ai-agent-crawl": "sig",
  "trap-crawler": "sig",
};
export const toneOf = (pattern: string): Tone => PATTERN_TONE[pattern] ?? "text3";
