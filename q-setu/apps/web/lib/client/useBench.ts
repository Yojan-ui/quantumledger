"use client";

import type { BenchReport } from "@qsetu/core";
import { useEffect, useState } from "react";

let cache: Promise<BenchReport> | undefined;

/** The server's measured benchmark, fetched once per page load and shared by every meter. */
export function useBench(): BenchReport | undefined {
  const [r, setR] = useState<BenchReport>();
  useEffect(() => {
    cache ??= fetch("/api/bench").then((x) => x.json() as Promise<BenchReport>);
    let live = true;
    cache.then((v) => live && setR(v)).catch(() => (cache = undefined));
    return () => {
      live = false;
    };
  }, []);
  return r;
}
