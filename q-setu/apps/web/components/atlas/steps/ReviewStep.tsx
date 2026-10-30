"use client";

/**
 * Review: the latest run's results awaiting a person's decision. Operators approve or reject with a reason
 * (3–500 characters); Atlas signs each decision into the Proof Chain as review.decision and re-verifies it.
 */
import { useParams } from "next/navigation";
import { useState } from "react";
import { AtlasError, atlas, type ReviewItem } from "@/lib/client/atlas";
import { useAtlas, useAtlasMe } from "@/lib/client/useAtlas";
import { AtlasErrorPanel, Chip, Part, Skeleton } from "../AtlasUI";

function Decide({ ws, item, onDone }: { ws: string; item: ReviewItem; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async (decision: "approve" | "reject") => {
    setBusy(true);
    setErr(null);
    try {
      await atlas.decide(ws, item.id, decision, reason);
      onDone();
    } catch (e) {
      setErr(e instanceof AtlasError ? e.message : "decision failed");
    } finally {
      setBusy(false);
    }
  };
  const id = `reason-${item.id}`;
  return (
    <div className="mt-4 space-y-2">
      <label htmlFor={id} className="font-mono text-micro uppercase text-fg-3">
        Reason (3–500 characters, signed with the decision)
      </label>
      <textarea
        id={id}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={500}
        className="block w-full rounded-sm border border-line bg-inset px-3 py-2 text-small text-fg focus:border-line-strong"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || reason.trim().length < 3}
          onClick={() => void go("approve")}
          className="h-10 rounded-sm border border-ok px-4 font-mono text-micro uppercase text-ok disabled:opacity-40"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy || reason.trim().length < 3}
          onClick={() => void go("reject")}
          className="h-10 rounded-sm border border-danger px-4 font-mono text-micro uppercase text-danger disabled:opacity-40"
        >
          Reject
        </button>
      </div>
      {err && (
        <p role="alert" className="text-small text-danger">
          {err}
        </p>
      )}
    </div>
  );
}

export function ReviewStep() {
  const { ws } = useParams<{ ws: string }>();
  const me = useAtlasMe();
  // /reviews needs a session: signed out, say so instead of requesting it.
  const R = useAtlas(me.user ? `reviews:${ws}:${me.user.username}` : null, (signal) =>
    atlas.reviews(ws, { signal }),
  );
  if (!me.loading && !me.user)
    return (
      <Part title="Review">
        <p className="text-body text-fg-2">Sign in to see the items awaiting review.</p>
      </Part>
    );
  if (R.error)
    return R.error.status === 401 ? (
      <Part title="Review">
        <p className="text-body text-fg-2">Sign in to see the items awaiting review.</p>
      </Part>
    ) : (
      <AtlasErrorPanel error={R.error} onRetry={R.reload} />
    );
  // Reserve only a line while we learn who is signed in: a tall skeleton collapsing to one line shifted the page.
  if (!R.data) return <Skeleton className={me.user ? "mt-10 h-console" : "mt-10 h-24"} />;
  const { items, can_decide, read_only } = R.data;
  return (
    <Part
      title="Awaiting a person's decision"
      label={
        read_only ? "read-only snapshot: decisions disabled" : can_decide ? "operator" : "view only"
      }
    >
      {items.length === 0 ? (
        <p className="text-body text-fg-2">Nothing awaiting review: run the pipeline first.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((it) => (
            <li key={it.id} className="rounded-lg border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-body text-fg">{it.title}</span>
                <Chip status={it.status} />
              </div>
              <p className="mt-1 text-small text-fg-2">{it.summary}</p>
              <p className="mt-1 font-mono text-micro text-fg-3">
                {it.kind} · run {it.run_id.slice(0, 12)} · evidence{" "}
                {it.evidence_sha256.slice(0, 12)}…
              </p>
              {it.decision && (
                <p className="mt-2 text-small text-fg-2">
                  {it.decision.decision === "approve" ? "Approved" : "Rejected"} by {it.decision.by}{" "}
                  at {it.decision.ts}: “{it.decision.reason}”
                  {it.decision.ledger_index !== undefined
                    ? ` · Proof Chain #${it.decision.ledger_index}`
                    : ""}
                </p>
              )}
              {it.status === "pending" && can_decide && (
                <Decide ws={ws} item={it} onDone={R.reload} />
              )}
            </li>
          ))}
        </ul>
      )}
    </Part>
  );
}
