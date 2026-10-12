"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Text } from "@/components/ui";
import { track } from "@/lib/client/analytics";
import { errText } from "@/lib/client/api";
import type { ScanView } from "@/lib/scan-types";
import { ScanResult, ScanSkeleton } from "./ScanResult";

/** A shared result: shows the stored scan, or runs one now if this host hasn't been scanned yet. */
export function ScanPage({ host, initial }: { host: string; initial?: ScanView }) {
  const [r, setR] = useState(initial);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(!initial);

  async function run() {
    setBusy(true);
    setError(undefined);
    track("scan_run", { source: "share-page" });
    try {
      const res = await fetch("/api/scan/url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: host }),
      });
      const d = (await res.json()) as ScanView;
      if (!res.ok) throw new Error(errText(d, `Scan failed (${res.status})`));
      setR(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!initial) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (busy) return <ScanSkeleton />;
  if (error)
    return (
      <div className="space-y-3" role="alert">
        <p className="text-body text-fg">We couldn’t scan {host}.</p>
        <Text size="small">{error}</Text>
        <Button onClick={() => run()}>Try again</Button>
      </div>
    );
  if (!r) return null;
  return (
    <div className="space-y-8">
      <ScanResult r={r} />
      <div className="flex flex-wrap gap-6 border-t border-line pt-6">
        <button
          type="button"
          onClick={() => void run()}
          className="text-small text-fg-2 hover:text-fg"
        >
          Scan again now
        </button>
        <Link href="/#scan" className="text-small text-fg-2 hover:text-fg">
          Scan another site
        </Link>
      </div>
    </div>
  );
}
