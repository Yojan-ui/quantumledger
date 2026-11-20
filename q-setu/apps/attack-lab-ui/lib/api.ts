"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AttackEvent,
  ChainReport,
  Incident,
  IncidentCheck,
  Pattern,
  ReplayReport,
  ReplayStepResult,
  Timeline,
} from "@qsetu/attack-lab";

export type IncidentSummary = Omit<Incident, "eventHashes"> & {
  pattern: { id: string; name: string };
  steps: number;
  durationMs: number;
  actions: Record<string, number>;
  sealed: boolean;
};

export interface Overview {
  incidents: IncidentSummary[];
  totals: { incidents: number; events: number; flagged: number; records: number; patterns: number };
  key: { alg: string; keyId: string; publicKey: string };
  sandbox: { bare: string; protected: string };
  simulating: boolean;
  scenarios: { id: string; label: string }[];
}

export interface IncidentDetail {
  incident: Incident;
  pattern: { id: string; name: string; description: string };
  timeline: Timeline;
  events: (AttackEvent & { id: string; seq: number; hash: string; sig: string })[];
  seal?: { seq: number; hash: string; covers: number };
  check: IncidentCheck;
  key: { alg: string; keyId: string };
}

export interface ReplayJob {
  id: string;
  incidentId: string;
  pattern: string;
  startedAt: number;
  finishedAt?: number;
  status: "running" | "done" | "failed";
  total: number;
  steps: ReplayStepResult[];
  report?: ReplayReport;
  error?: string;
}

export type { ChainReport, Pattern };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { cache: "no-store", ...init });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error ?? `${r.status}`);
  return j;
}

export const post = <T>(path: string, body: unknown) =>
  api<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

/** Polls `path` every `ms` while the tab is visible. `null` path pauses. */
export function usePoll<T>(path: string | null, ms = 2000) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const alive = useRef(true);
  const load = useCallback(async () => {
    if (!path) return;
    try {
      const d = await api<T>(path);
      if (alive.current) {
        setData(d);
        setError(undefined);
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
    }
  }, [path]);
  useEffect(() => {
    alive.current = true;
    void load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, ms);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [load, ms]);
  return { data, error, reload: load };
}

export function ago(t: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86_400)}d ago`;
}

export function dur(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 60_000)} min`;
}

export const time = (t: number) =>
  new Date(t).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
