/**
 * Typed client for the Q-Shield Atlas backend through the same-origin proxy (/atlas-api/* -> Atlas /api/*).
 * results / bench / ledger entries use types generated from qshield/contracts/*.schema.json (atlas-types.ts);
 * the other responses are typed from what qshield/atlas_web/server.py returns. Every non-GET request sends
 * the atlas_csrf cookie as X-CSRF-Token (Atlas's double-submit check). Errors carry Atlas's
 * { error: { code, message } } (atlas_down when the backend is not running).
 */
import type { AtlasBench, AtlasResults } from "./atlas-types";

export type { AtlasBench, AtlasResults } from "./atlas-types";
export type QaoaRow = AtlasResults["qaoa"] extends infer Q
  ? Q extends { table: (infer R)[] }
    ? R
    : never
  : never;

export const ATLAS_BASE = "/atlas-api";

export type Role = "viewer" | "operator" | "admin";
export type Me = {
  user: { username: string; role: Role; expires: number } | null;
  kiosk: boolean;
  demo: boolean;
};
export type Stage = { id: string; label: string; plain: string; steps: string[] };
export type WorkspaceSummary = {
  id: string;
  name: string;
  template: string;
  read_only: boolean;
  has_results: boolean;
  type?: string;
  assets?: number | null;
  ledger_verified?: boolean | null;
  generated_at?: string | null;
  last_run?: { ts: number; status: string } | null;
  source?: Record<string, unknown> | null;
};
export type ResultsResponse = {
  workspace: string;
  results: AtlasResults | null;
  status_text: string | null;
};
export type LedgerEntry = {
  index: number;
  type: string;
  payload_ref: string;
  payload_hash: string;
  prev_hash: string;
  ts: string;
};
export type LiveVerification =
  | {
      ok: boolean;
      entries_checked: number;
      root?: string;
      first_failure: unknown;
      checked_at: string;
      recorded: false;
    }
  | { ok: null; status_text: string; recorded: false } // verification could not run (e.g. no ML-DSA OpenSSL)
  | null;
export type LedgerResponse =
  | { available: false; status_text: string }
  | {
      available: true;
      root: string;
      entry_count: number;
      alg: string;
      backend: string;
      pubkey_fp: string;
      ledger_ref: string;
      entries: LedgerEntry[];
      recorded_verification: unknown;
      live_verification: LiveVerification;
    };
export type RunRow = {
  id: string;
  workspace: string;
  username: string;
  kind: string;
  started: number;
  finished: number | null;
  status: string;
  detail: Record<string, unknown>;
};
export type RunsResponse = { runs: RunRow[]; active: string | null };
export type RunEvent = {
  seq: number;
  type: "run_start" | "step_start" | "line" | "step_end" | "run_end";
  ts: number;
  [k: string]: unknown;
};
/** One item awaiting review (qshield/atlas_web/review.py listing()). */
export type ReviewItem = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  run_id: string;
  evidence_sha256: string;
  status: "pending" | "approved" | "rejected";
  decision: {
    decision: "approve" | "reject";
    reason: string;
    by: string;
    ts: string;
    ledger_index?: number;
  } | null;
};
export type ReviewsResponse = { items: ReviewItem[]; read_only: boolean; can_decide: boolean };
/** GET /workspaces/<ws>/progress: the plan files a run writes before results.json exists (read-only). */
export type ProgressResponse = {
  workspace: string;
  schedule: {
    assets: {
      id: string;
      name: string;
      risk_weight: number;
      planned_week: number | null;
      algorithm: string;
      status: string;
    }[];
    waves: { week: number; assets: string[] }[];
  } | null;
  tiebreak: Record<string, unknown> | null;
  wave_status: {
    waves?: { week: number; status: string; asset_status?: Record<string, string> }[];
    asset_status?: Record<string, string>;
  } | null;
};
export type BenchResponse = {
  workspace: string;
  bench: AtlasBench | null;
  ledger_index: number | null;
  crypto: Record<string, unknown> | null;
  crypto_ledger_index: number | null;
  status_text: string | null;
};
export type QuantumStatus = {
  backend: string;
  backend_id: string;
  kind: string;
  hardware: false;
  fallback_reason: string | null;
  checked_at: string;
  cloud: {
    sdk: string;
    sdk_version: string;
    reachable: boolean;
    enabled: boolean;
    device: string;
    error: string | null;
    devices: { name: string; status: string; method?: string }[];
  };
};

export class AtlasError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function csrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)atlas_csrf=([^;]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  init: { signal?: AbortSignal; raw?: BodyInit; contentType?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== "GET") {
    const t = csrfToken();
    if (t) headers["X-CSRF-Token"] = t;
  }
  let payload: BodyInit | undefined;
  if (init.raw !== undefined) {
    payload = init.raw;
    if (init.contentType) headers["Content-Type"] = init.contentType;
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }
  const r = await fetch(`${ATLAS_BASE}${path}`, {
    method,
    headers,
    body: payload,
    credentials: "same-origin",
    signal: init.signal,
    cache: "no-store",
  });
  const data = r.headers.get("content-type")?.includes("json")
    ? await r.json().catch(() => null)
    : null;
  if (!r.ok) {
    const e = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new AtlasError(
      r.status,
      e?.code ?? "http_error",
      e?.message ?? `Q-Shield request failed (${r.status})`,
    );
  }
  return data as T;
}

const ws = (id: string) => `/workspaces/${encodeURIComponent(id)}`;
type O = { signal?: AbortSignal };

export const atlas = {
  me: (o: O = {}) => req<Me>("GET", "/me", undefined, o),
  login: (username: string, password: string) =>
    req<{ user: Me["user"] }>("POST", "/auth/login", { username, password }),
  logout: () => req<{ ok: true }>("POST", "/auth/logout", {}),
  stages: (o: O = {}) => req<{ stages: Stage[] }>("GET", "/stages", undefined, o),
  workspaces: (o: O = {}) =>
    req<{ workspaces: WorkspaceSummary[]; templates: Record<string, string> }>(
      "GET",
      "/workspaces",
      undefined,
      o,
    ),
  createWorkspace: (id: string, name: string, template: string) =>
    req<WorkspaceSummary>("POST", "/workspaces", { id, name, template }),
  workspace: (id: string, o: O = {}) => req<WorkspaceSummary>("GET", ws(id), undefined, o),
  results: (id: string, o: O = {}) =>
    req<ResultsResponse>("GET", `${ws(id)}/results`, undefined, o),
  progress: (id: string, o: O = {}) =>
    req<ProgressResponse>("GET", `${ws(id)}/progress`, undefined, o),
  inventory: (id: string, o: O = {}) =>
    req<Record<string, unknown>>("GET", `${ws(id)}/inventory`, undefined, o),
  ledger: (id: string, o: O = {}) => req<LedgerResponse>("GET", `${ws(id)}/ledger`, undefined, o),
  proof: (id: string, index: number, o: O = {}) =>
    req<Record<string, unknown>>("GET", `${ws(id)}/ledger/proof/${index}`, undefined, o),
  tamperDemo: (id: string, index?: number) =>
    req<Record<string, unknown>>(
      "POST",
      `${ws(id)}/tamper-demo`,
      index === undefined ? {} : { index },
    ),
  runs: (id: string, o: O = {}) => req<RunsResponse>("GET", `${ws(id)}/runs`, undefined, o),
  startRun: (
    id: string,
    opts: { probes?: string[]; presets?: string[]; authorised?: boolean } = {},
  ) => req<{ run_id: string }>("POST", `${ws(id)}/runs`, opts),
  reviews: (id: string, o: O = {}) =>
    req<ReviewsResponse>("GET", `${ws(id)}/reviews`, undefined, o),
  decide: (id: string, item: string, decision: "approve" | "reject", reason: string) =>
    req<{ decision: unknown; items: ReviewItem[] }>("POST", `${ws(id)}/reviews`, {
      item,
      decision,
      reason,
    }),
  estimate: (id: string, o: O = {}) =>
    req<Record<string, unknown>>("GET", `${ws(id)}/estimate`, undefined, o),
  bench: (id: string, o: O = {}) => req<BenchResponse>("GET", `${ws(id)}/bench`, undefined, o),
  quantumStatus: (o: O = {}) => req<QuantumStatus>("GET", "/quantum/status", undefined, o),
  quantumRun: (id: string, p: 1 | 2 | 3 = 1) =>
    req<Record<string, unknown>>("POST", "/quantum/run", { ws: id, p }),
  clone: (id: string, url: string, commit?: string) =>
    req<{ url: string; commit: string; files: number }>("POST", `${ws(id)}/clone`, { url, commit }),
  upload: (id: string, zip: Blob) =>
    req<Record<string, unknown>>("POST", `${ws(id)}/upload`, undefined, {
      raw: zip,
      contentType: "application/zip",
    }),
  reportUrl: (id: string) => `${ATLAS_BASE}${ws(id)}/report`,

  /** Live run log over SSE (EventSource reconnects with Last-Event-ID; Atlas resumes after it). Returns close(). */
  runEvents(
    id: string,
    runId: string,
    on: (ev: RunEvent) => void,
    onError?: () => void,
  ): () => void {
    const es = new EventSource(`${ATLAS_BASE}${ws(id)}/runs/${encodeURIComponent(runId)}/events`);
    const types: RunEvent["type"][] = ["run_start", "step_start", "line", "step_end", "run_end"];
    for (const t of types)
      es.addEventListener(t, (m) => {
        const ev = JSON.parse((m as MessageEvent<string>).data) as RunEvent;
        on(ev);
        if (t === "run_end") es.close();
      });
    if (onError) es.onerror = onError;
    return () => es.close();
  },
};
