"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import { endpointError, scanEndpoints } from "@/lib/client/endpoint-intake";
import { useAtlasMe } from "@/lib/client/useAtlas";

/** Recorded live scan (www.cloudflare.com, www.wikipedia.org) kept as the offline fallback. */
export const RECORDED_SCAN_WS = "tls-check3";

/**
 * "Send to pipeline": the scanned host becomes real inventory in a new Atlas workspace (Atlas re-checks
 * that it is public and does its own single handshake), then the pipeline runs and streams live.
 */
export function SendToPipeline({ host }: { host: string }) {
  const me = useAtlasMe();
  const router = useRouter();
  const locked = useRef(false);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const send = async () => {
    if (locked.current) return;
    setErr("");
    if (!ok) return setErr("Confirm that you own or are authorised to assess this host.");
    if (!me.user) {
      router.push(`/atlas/signin?next=${encodeURIComponent("/#scan")}`);
      return;
    }
    if (!me.canOperate) return setErr("An Atlas operator account is needed to run the pipeline.");
    locked.current = true;
    setBusy(true);
    try {
      const { id, run_id } = await scanEndpoints(host, setMsg);
      router.push(`/atlas/${encodeURIComponent(id)}?run=${encodeURIComponent(run_id)}`);
    } catch (e) {
      setErr(endpointError(e));
      setMsg("");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3 rounded-lg border border-line p-4" data-send-pipeline>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <label className="flex items-start gap-2 text-small text-fg-2">
          <input
            type="checkbox"
            checked={ok}
            onChange={(e) => setOk(e.target.checked)}
            disabled={busy}
            className="mt-1"
          />
          <span>Scan only hosts you own or are authorised to assess. I confirm that I am.</span>
        </label>
        <Button onClick={() => void send()} disabled={busy} className="shrink-0">
          {busy ? "Sending…" : "Send to pipeline"}
        </Button>
      </div>
      {msg && (
        <p role="status" className="text-small text-fg-2">
          {msg}
        </p>
      )}
      {err && (
        <div role="alert" className="space-y-1 text-small">
          <p className="text-danger">{err}</p>
          <Link
            prefetch={false}
            href={`/atlas/${RECORDED_SCAN_WS}`}
            className="text-fg-2 underline underline-offset-4 hover:text-fg"
          >
            Open the recorded live scan instead (cloudflare.com, wikipedia.org; sign-in needed)
          </Link>
        </div>
      )}
    </div>
  );
}
