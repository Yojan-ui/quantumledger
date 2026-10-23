/**
 * What the lab keeps about a request, and what it throws away. IPs and session cookies become keyed
 * hashes (HMAC-SHA256 under a salt that never leaves the lab), the user agent becomes a family name,
 * the query string is dropped, and any canary key in the path is replaced before anything is stored.
 */
import { createHmac } from "node:crypto";
import { netOf } from "@qsetu/shield-guard";
import type { ClientFamily, RouteClass } from "./types";

export function hashOf(salt: string, value: string): string {
  return createHmac("sha256", salt).update(value).digest("hex").slice(0, 16);
}

export const ipHash = (salt: string, ip: string) => hashOf(salt, `ip:${ip}`);
export const netHash = (salt: string, ip: string) => hashOf(salt, `net:${netOf(ip)}`);

const AI_AGENT =
  /\b(GPTBot|ChatGPT-User|ClaudeBot|Claude-User|CCBot|Bytespider|PerplexityBot|Amazonbot|anthropic-ai|cohere-ai)\b/i;
const HEADLESS = /\b(HeadlessChrome|PhantomJS|Playwright|Puppeteer)\b/i;
const SCRIPT =
  /\b(curl|wget|python-requests|python-urllib|aiohttp|httpx|Go-http-client|node-fetch|axios|okhttp|libwww-perl|Scrapy)\b/i;
const SEARCH = /\b(Googlebot|AdsBot-Google|bingbot|DuckDuckBot|Applebot)\b/i;
const BROWSER = /Mozilla\/5\.0 .*(Chrome|Firefox|Safari|Edg)\//;

export function clientFamily(ua: string | undefined): ClientFamily {
  if (!ua) return "none";
  if (AI_AGENT.test(ua)) return "ai-agent";
  if (SEARCH.test(ua)) return "search-bot";
  if (HEADLESS.test(ua)) return "headless";
  if (SCRIPT.test(ua)) return "script";
  if (BROWSER.test(ua)) return "browser";
  return "other";
}

/** Path only, canary keys masked, at most 120 characters. */
export function safeRoute(pathAndQuery: string, canaryKeys: string[] = []): string {
  let p = pathAndQuery.split(/[?#]/)[0] || "/";
  for (const k of canaryKeys) if (k) p = p.split(k).join("[canary]");
  return p.length > 120 ? `${p.slice(0, 117)}...` : p;
}

const SECRETS =
  /^\/(\.env|\.git\/|\.aws\/|backup\.zip|.*\.(sql|bak|zip|tar\.gz)$|config\.(json|ya?ml|php)$)/i;
const ADMIN =
  /^\/(wp-login\.php|wp-admin\/|xmlrpc\.php|phpmyadmin\/|admin\b|server-status|administrator\b)/i;

export function routeClass(route: string, trapPath?: string): RouteClass {
  if (trapPath && route.toLowerCase() === trapPath.toLowerCase()) return "trap";
  if (SECRETS.test(route)) return "secrets";
  if (ADMIN.test(route)) return "admin";
  if (route.startsWith("/api/")) return "api";
  if (route === "/" || /\.html?$/.test(route) || !/\.[a-z0-9]+$/i.test(route)) return "page";
  return "other";
}
