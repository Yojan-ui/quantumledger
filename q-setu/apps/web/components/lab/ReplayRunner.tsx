"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Panel } from "@/components/ui";
import type { ReplayJob } from "@/lib/lab/types";
import { Chip, PhaseChip } from "./ui";

type Option = { id: string; label: string };

const BARE = { served: "warn", "not found": "fg-2", error: "fg-3" } as const;
const PROT = {
  passed: "warn",
  blocked: "ok",
  challenged: "ok",
  limited: "ok",
  error: "fg-3",
} as const;

/**
 * Team only. Starts a replay through /api/lab/replay; the engine runs it against a fresh pair of
 * legacy-bank copies on its own loopback, one bare and one behind Shield. This page only shows the
 * results: it never sends traffic anywhere itself.
 */
export function ReplayRunner({
  options,
  initial,
  job: initialJob,
  customer,
}: {
  options: Option[];
  initial?: string;
  job?: string;
  customer?: string;
}) {
  const router = useRouter();
  const [incident, setIncident] = useState(initial ?? options[0]?.id ?? "");
  const [jobId, setJobId] = useState(initialJob);
  const [job, setJob] = useState<ReplayJob>();

  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const tick = async () => {
      const r = await fetch(`/api/lab/replay/${jobId}`, { cache: "no-store" });
      if (!r.ok || stop) return;
      const j = (await r.json()) as ReplayJob;
      setJob(j);
      if (j.status === "running") setTimeout(tick, 700);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [jobId]);

  const steps = job?.steps ?? [];
  const n = (f: (s: ReplayJob["steps"][number]) => boolean) => steps.filter(f).length;
  const refused = n((s) => ["blocked", "challenged", "limited"].includes(s.protected.outcome));

  return (
    <>
      <Panel className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex min-w-0 max-w-full flex-col gap-2">
            <span className="font-mono text-label uppercase text-fg-3">Saved incident</span>
            <select
              value={incident}
              onChange={(e) => setIncident(e.target.value)}
              className="h-10 max-w-full rounded-sm border border-line-strong bg-raised px-3 text-small text-fg"
            >
              {!options.length && <option value="">No incidents yet</option>}
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="primary"
            disabled={!incident || job?.status === "running"}
            onClick={async () => {
              const r = await fetch("/api/lab/replay", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ incidentId: incident }),
              });
              const j = (await r.json()) as { id?: string; error?: { message: string } };
              if (!r.ok || !j.id) throw new Error(j.error?.message ?? "Couldn't start the replay");
              setJob(undefined);
              setJobId(j.id);
              const qs = new URLSearchParams({
                incident,
                job: j.id,
                ...(customer ? { customer } : {}),
              });
              router.replace(`/lab/replay?${qs}`);
            }}
          >
            {job?.status === "running"
              ? `Replaying ${steps.length}/${job.total}`
              : "Replay against the sandbox"}
          </Button>
        </div>
        <p className="mt-4 text-small text-fg-3">
          Runs on this server’s loopback only (localhost or the legacy-bank demo). The engine
          refuses any other host.
        </p>
      </Panel>

      {job && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <Panel className="border-warn">
              <p className="font-mono text-label uppercase text-fg-3">Bare legacy bank</p>
              <p className="mt-2 text-h3 font-medium text-warn">
                Answered {steps.length - n((s) => s.bare.outcome === "error")} of {steps.length}
              </p>
              <p className="mt-2 text-small text-fg-2">
                {n((s) => s.bare.outcome === "served")} served,{" "}
                {n((s) => s.bare.outcome === "not found")} not found. Nothing tells it the source is
                hostile.
              </p>
            </Panel>
            <Panel className="border-ok">
              <p className="font-mono text-label uppercase text-fg-3">
                Behind Shield (protect mode)
              </p>
              <p className="mt-2 text-h3 font-medium text-ok">
                Refused {refused} of {steps.length}
              </p>
              <p className="mt-2 text-small text-fg-2">
                {n((s) => s.protected.outcome === "passed")} let through
                {job.report?.summary.firstStop !== undefined
                  ? `; first refusal at step ${job.report.summary.firstStop + 1}.`
                  : "."}
              </p>
            </Panel>
          </div>
          {job.status === "failed" && (
            <p className="mb-6 text-small text-danger">Replay failed: {job.error}</p>
          )}
          <div className="overflow-x-auto rounded-lg border border-line bg-raised">
            <table className="w-full text-left text-small">
              <thead>
                <tr className="border-b border-line font-mono text-label uppercase text-fg-3">
                  <th className="px-4 py-3 font-normal">#</th>
                  <th className="px-4 py-3 font-normal">Request</th>
                  <th className="px-4 py-3 font-normal">Phase</th>
                  <th className="px-4 py-3 font-normal">Bare</th>
                  <th className="px-4 py-3 font-normal">Protected</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((s) => (
                  <tr key={s.i} className="border-b border-line last:border-b-0">
                    <td className="tabular px-4 py-3 font-mono text-fg-3">{s.i + 1}</td>
                    <td className="break-all px-4 py-3 font-mono text-fg">
                      <span className="text-fg-3">{s.method}</span> {s.route}
                    </td>
                    <td className="px-4 py-3">
                      <PhaseChip phase={s.phase} />
                    </td>
                    <td className="px-4 py-3">
                      <Chip tone={BARE[s.bare.outcome]}>
                        {s.bare.outcome} {s.bare.status || ""}
                      </Chip>
                    </td>
                    <td className="px-4 py-3">
                      <Chip tone={PROT[s.protected.outcome]}>
                        {s.protected.outcome} {s.protected.status || ""}
                      </Chip>
                      {s.protected.signals.length > 0 && (
                        <span className="mt-1 block text-small text-fg-3">
                          {s.protected.signals.join(" · ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!steps.length && (
              <p className="p-6 text-small text-fg-2">Starting a fresh sandbox pair…</p>
            )}
          </div>
          {job.report && (
            <ul className="mt-4 list-disc pl-5 text-small text-fg-3">
              {job.report.notes.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
