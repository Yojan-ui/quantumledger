import "server-only";

/**
 * The Attack Lab engine's local API (packages/attack-lab, `pnpm --filter @qsetu/attack-lab dev`).
 * The engine records, signs, verifies and replays; the website only reads it and asks it to act.
 * It has no users of its own: lib/lab/access decides what each signed-in person may ask for.
 */
const BASE = () => (process.env.ATTACK_LAB_API ?? "http://127.0.0.1:4100").replace(/\/$/, "");

export class EngineDown extends Error {
  constructor() {
    super("The Attack Lab engine isn't answering.");
    this.name = "EngineDown";
  }
}

export async function engine<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.ATTACK_LAB_TOKEN;
  let r: Response;
  try {
    r = await fetch(BASE() + path, {
      ...init,
      cache: "no-store",
      headers: {
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new EngineDown();
  }
  if (r.status === 404) throw new EngineMissing();
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error ?? `Engine answered ${r.status}`);
  return j;
}

export class EngineMissing extends Error {
  constructor() {
    super("Not found");
    this.name = "EngineMissing";
  }
}
