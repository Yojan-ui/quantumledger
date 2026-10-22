import { fail, readText } from "@/lib/server/api";
import { SCAN_LIMITS, take, tooMany } from "@/lib/server/limits";
import { ScanError } from "@/lib/live/tls";
import { engine } from "@/lib/lab/engine";
import { withLab } from "@/lib/lab/route";
import { scanEmail, scanWebsite, type EmailScan, type WebScan } from "@/lib/lab/scan";
import type { Threat, Verdict } from "@/lib/lab/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which reference threats are worth showing for what the scan found. */
function relevant(r: WebScan | EmailScan): string[] {
  if (r.kind === "email") return ["agent-swarm-100-breaches"];
  const ids = ["agent-swarm-100-breaches"];
  if (r.http?.login.length) ids.push("ai-orchestrated-espionage");
  if (r.http?.api.length) ids.push("opencode-48h");
  if (ids.length < 3) ids.push("hugging-face-agent-attack");
  return ids;
}

/**
 * POST /api/lab/scan { input }: a read-only readiness check of a public website or an email
 * domain (see lib/lab/scan), plus what an AI-agent attacker would probe there and how the threat
 * model scores that kind of traffic. Signed-in Lab users only; 10 a minute, 100 a day.
 */
export async function POST(req: Request) {
  return withLab(req, {}, async () => {
    let input = "";
    try {
      input = String(
        (JSON.parse((await readText(req, 1024)) ?? "{}") as { input?: unknown }).input ?? "",
      ).trim();
    } catch {
      input = "";
    }
    if (!input || input.length > 300)
      return fail("invalid_input", "Enter a website or an email address.", 400);
    const v = await take(req, SCAN_LIMITS);
    if (!v.ok) return tooMany(v, "scans");
    let result: WebScan | EmailScan;
    try {
      result = input.includes("@") ? await scanEmail(input) : await scanWebsite(input);
    } catch (e) {
      const msg =
        e instanceof ScanError && e.code === "blocked_target"
          ? "That address points inside a private network. Only public sites can be checked."
          : e instanceof ScanError && e.code === "invalid_input"
            ? "That doesn't look like a website or an email address."
            : "Couldn't reach it from this computer. Check the address, or try one of the suggested sites (they work offline).";
      return fail(
        e instanceof ScanError && e.code === "invalid_input" ? "invalid_input" : "unreachable",
        msg,
        422,
      );
    }
    let probes: { threat: Threat; verdict?: Verdict }[] = [];
    try {
      const p = await engine<{
        profiles: { threatId: string; verdict: Verdict }[];
        threats: Threat[];
      }>("/api/model/profiles");
      probes = relevant(result).flatMap((id) => {
        const threat = p.threats.find((t) => t.id === id);
        const verdict = p.profiles.find((x) => x.threatId === id)?.verdict;
        return threat ? [{ threat, ...(verdict ? { verdict } : {}) }] : [];
      });
    } catch {
      probes = [];
    }
    return Response.json({ result, probes });
  });
}
