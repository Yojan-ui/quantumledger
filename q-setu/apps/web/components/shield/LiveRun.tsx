"use client";

/**
 * The side-by-side: runs the attack suite on the server against the legacy bank app, bare and behind
 * Shield Edge, and shows what each attacker got. Numbers come from the run, nothing is scripted.
 */
import { useState } from "react";
import { Button, Label, Panel, Text } from "@/components/ui";

interface Result {
  attack: string;
  sent: number;
  answered: number;
  refused: number;
  notFound: number;
  errors: number;
  ms: number;
  note?: string;
}
interface Tls {
  encrypted: boolean;
  protocol?: string;
  group?: string;
  note: string;
}
interface Run {
  bare: Result[];
  edge: Result[];
  tls: { bare: Tls; edge: Tls };
  ms: number;
}

function Cell({ r }: { r: Result }) {
  return (
    <div className="font-mono text-micro tabular text-fg-2">
      <span className="text-fg">{r.answered}</span> answered ·{" "}
      <span className={r.refused ? "text-ok" : ""}>{r.refused} stopped</span> · {r.notFound} not
      found{r.errors ? ` · ${r.errors} failed` : ""}{" "}
      <span className="text-fg-3">· {(r.ms / 1000).toFixed(1)} s</span>
    </div>
  );
}

export function LiveRun() {
  const [run, setRun] = useState<Run>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const go = async () => {
    setBusy(true);
    setErr(undefined);
    try {
      const r = await fetch("/api/shield/live", { method: "POST" });
      const j = (await r.json()) as Run & { error?: { message: string } };
      if (!r.ok) throw new Error(j.error?.message ?? `Failed (${r.status})`);
      setRun(j);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="primary" onClick={go} disabled={busy}>
          {busy ? "Attacking… (about 20 s)" : run ? "Run it again" : "Run the attack suite"}
        </Button>
        {run && (
          <Text size="small">
            Finished in {(run.ms / 1000).toFixed(1)} s, on this server&apos;s own loopback
            interface.
          </Text>
        )}
      </div>
      {err && (
        <p role="alert" className="text-small text-danger">
          {err}
        </p>
      )}
      {run && (
        <Panel padded={false}>
          <div className="grid grid-cols-1 border-b border-line md:grid-cols-3">
            <div className="p-4">
              <Label>Attack</Label>
            </div>
            <div className="border-t border-line p-4 md:border-l md:border-t-0">
              <Label>Legacy bank, bare</Label>
            </div>
            <div className="border-t border-line p-4 md:border-l md:border-t-0">
              <Label tone="strong">Behind Shield Edge (protect)</Label>
            </div>
          </div>
          {run.bare.map((b, i) => {
            const e = run.edge[i]!;
            return (
              <div key={b.attack} className="grid grid-cols-1 border-b border-line md:grid-cols-3">
                <div className="p-4">
                  <p className="text-small text-fg">{b.attack}</p>
                  <p className="mt-1 font-mono text-micro text-fg-3">{b.sent} requests</p>
                  {b.note && <p className="mt-2 text-small text-fg-3">{b.note}</p>}
                </div>
                <div className="p-4 md:border-l md:border-line">
                  <Cell r={b} />
                </div>
                <div className="p-4 md:border-l md:border-line">
                  <Cell r={e} />
                </div>
              </div>
            );
          })}
          <div className="grid grid-cols-1 md:grid-cols-3">
            <div className="p-4">
              <p className="text-small text-fg">TLS check: what an eavesdropper records</p>
            </div>
            <div className="p-4 md:border-l md:border-line">
              <p className="text-small text-danger">{run.tls.bare.note}</p>
            </div>
            <div className="p-4 md:border-l md:border-line">
              <p className="font-mono text-micro text-fg">
                {[run.tls.edge.protocol, run.tls.edge.group].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-1 text-small text-fg-2">{run.tls.edge.note}</p>
            </div>
          </div>
        </Panel>
      )}
      <Text size="small" className="text-fg-3">
        &ldquo;Stopped&rdquo; means Shield answered instead of the app: a limit (429), a challenge
        or block (403), or a honeypot&apos;s slow 404 that is followed by a block. Each attack
        starts with a fresh Shield state. The attack tools refuse any host but this server&apos;s
        own loopback interface. SSRF: the site&apos;s own URL scanner refuses internal addresses;
        that guard has its own tests (127.0.0.1, 169.254.169.254, [::1], ::ffff:10.0.0.1, names that
        resolve inside).
      </Text>
    </div>
  );
}
