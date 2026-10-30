"use client";

import { useParams } from "next/navigation";
import { atlas, type AtlasResults } from "@/lib/client/atlas";
import { useAtlas } from "@/lib/client/useAtlas";

/** This page's workspace id and its results.json (null when not yet run). Public for `demo`. */
export function useResults() {
  const { ws } = useParams<{ ws: string }>();
  const q = useAtlas(`results:${ws}`, (signal) => atlas.results(ws, { signal }));
  const results: AtlasResults | null | undefined = q.data ? q.data.results : undefined;
  return {
    ws,
    results,
    statusText: q.data?.status_text ?? null,
    error: q.error,
    loading: q.loading,
    reload: q.reload,
  };
}

/** A number for display; null / undefined / NaN read as "–", never 0. */
export const fmt = (v: unknown, digits = 0): string =>
  typeof v === "number" && Number.isFinite(v)
    ? v.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits })
    : "–";

export const pct = (v: unknown): string =>
  typeof v === "number" && Number.isFinite(v) ? `${(v * 100).toFixed(2)} %` : "–";
