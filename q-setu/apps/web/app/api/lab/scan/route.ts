import { fail, readText } from "@/lib/server/api";
import { SCAN_LIMITS, take, tooMany } from "@/lib/server/limits";
import { engine } from "@/lib/lab/engine";
import { withLab } from "@/lib/lab/route";
import {
  classifyInput,
  ScanFailed,
  scanEmail,
  scanWebsite,
  type EmailScan,
  type Step,
  type WebScan,
} from "@/lib/lab/scan";
import type { Threat, Verdict } from "@/lib/lab/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The whole scan, end to end, never takes longer than this. */
const SCAN_MS = 10_000;

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
 * POST /api/lab/scan { input }: a live, read-only readiness check of a public website or an email
 * domain (lib/lab/scan), what an AI-agent attacker would probe there and how the threat model
 * scores that kind of traffic. Saved to the signed-in user's workspace. 10 s at most; a scan that
 * can't finish says exactly what was tried. Signed-in Lab users only; 10 a minute, 100 a day.
 */
export async function POST(req: Request) {
  return withLab(req, {}, async ({ user }) => {
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

    const c = classifyInput(input);
    const steps: Step[] = [];
    const target = c.kind === "email" ? `@${c.domain}` : c.target;
    const workspace = user.customerId ?? "team";
    const save = (kind: "website" | "email" | "error", result: unknown) =>
      engine("/api/scans", {
        method: "POST",
        body: JSON.stringify({ customerId: workspace, by: user.email, input, kind, result }),
      }).catch(() => undefined);

    let result: WebScan | EmailScan;
    try {
      result = await Promise.race([
        c.kind === "email" ? scanEmail(c.domain, steps) : scanWebsite(c.target, steps),
        new Promise<never>((_, r) =>
          setTimeout(
            () =>
              r(
                new ScanFailed(
                  `${target} didn't finish within 10 seconds: it may be slow, down, or blocking automated checks.`,
                  target,
                  steps,
                ),
              ),
            SCAN_MS,
          ),
        ),
      ]);
    } catch (e) {
      const f =
        e instanceof ScanFailed
          ? e
          : new ScanFailed(
              `Couldn't check ${target}: something went wrong on this computer.`,
              target,
              steps,
            );
      const failure = { message: f.message, target: f.target, steps: [...f.steps] };
      await save("error", failure);
      return Response.json({ failure }, { status: 200 });
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
    await save(result.kind, { ...result, probes });
    return Response.json({ result, probes });
  });
}
