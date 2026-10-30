"use client";

/**
 * /atlas: the Q-Shield workspaces. Signed out: the public read-only demo and a sign-in link. Signed in: every
 * workspace with Atlas's own summary; operators can create one from a template, clone a public repository
 * into it, or upload a .zip. Paid platform / QCloud runs are not offered here; Atlas's blocker text is shown.
 */
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Label } from "@/components/ui/type";
import { AtlasError, atlas } from "@/lib/client/atlas";
import { useAtlas, useAtlasMe } from "@/lib/client/useAtlas";
import { AtlasErrorPanel, Chip, Honesty, Part, Skeleton } from "./AtlasUI";

const field =
  "h-10 w-full rounded-sm border border-line bg-inset px-3 text-small text-fg focus:border-line-strong";
const btn =
  "h-10 rounded-sm border border-line-strong px-4 font-mono text-micro uppercase text-fg hover:bg-raised disabled:opacity-40";

function useAction() {
  const [s, setS] = useState<{ busy: boolean; ok?: string; err?: string }>({ busy: false });
  const run = async (f: () => Promise<string>) => {
    setS({ busy: true });
    try {
      setS({ busy: false, ok: await f() });
    } catch (e) {
      setS({ busy: false, err: e instanceof AtlasError ? e.message : "request failed" });
    }
  };
  return [s, run] as const;
}

function Msg({ s }: { s: { ok?: string; err?: string } }) {
  if (s.err)
    return (
      <p role="alert" className="text-small text-danger">
        {s.err}
      </p>
    );
  if (s.ok)
    return (
      <p role="status" className="text-small text-ok">
        {s.ok}
      </p>
    );
  return null;
}

function OperatorTools({
  ids,
  templates,
  onChange,
}: {
  ids: string[];
  templates: Record<string, string>;
  onChange: () => void;
}) {
  const [create, doCreate] = useAction();
  const [clone, doClone] = useAction();
  const [upload, doUpload] = useAction();
  const [nw, setNw] = useState({
    id: "",
    name: "",
    template: Object.keys(templates)[0] ?? "empty",
  });
  const [cl, setCl] = useState({ ws: ids.find((i) => i !== "demo") ?? "", url: "" });
  const [up, setUp] = useState<{ ws: string; file: File | null }>({
    ws: ids.find((i) => i !== "demo") ?? "",
    file: null,
  });
  const writable = ids.filter((i) => i !== "demo");
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <form
        className="space-y-3 rounded-lg border border-line p-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void doCreate(async () => {
            await atlas.createWorkspace(nw.id.trim(), nw.name.trim(), nw.template);
            onChange();
            return `Created ${nw.id.trim()}.`;
          });
        }}
      >
        <Label as="h3">New workspace</Label>
        <label className="block text-small text-fg-2">
          Id (a-z 0-9 -)
          <input
            className={field}
            value={nw.id}
            onChange={(e) => setNw({ ...nw, id: e.target.value })}
            required
            pattern="[a-z0-9-]{1,64}"
          />
        </label>
        <label className="block text-small text-fg-2">
          Name
          <input
            className={field}
            value={nw.name}
            onChange={(e) => setNw({ ...nw, name: e.target.value })}
            required
          />
        </label>
        <label className="block text-small text-fg-2">
          Template
          <select
            className={field}
            value={nw.template}
            onChange={(e) => setNw({ ...nw, template: e.target.value })}
          >
            {Object.entries(templates).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={create.busy} className={btn}>
          Create
        </button>
        <Msg s={create} />
      </form>
      <form
        className="space-y-3 rounded-lg border border-line p-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void doClone(async () => {
            const r = await atlas.clone(cl.ws, cl.url.trim());
            onChange();
            return `Cloned ${r.commit.slice(0, 12)} (${r.files} files). Confirm its manifests, then run the pipeline.`;
          });
        }}
      >
        <Label as="h3">Clone a public repository</Label>
        <label className="block text-small text-fg-2">
          Into workspace
          <select
            className={field}
            value={cl.ws}
            onChange={(e) => setCl({ ...cl, ws: e.target.value })}
            required
          >
            {writable.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
        </label>
        <label className="block text-small text-fg-2">
          https URL
          <input
            className={field}
            type="url"
            placeholder="https://github.com/org/repo"
            value={cl.url}
            onChange={(e) => setCl({ ...cl, url: e.target.value })}
            required
          />
        </label>
        <button type="submit" disabled={clone.busy || !cl.ws} className={btn}>
          {clone.busy ? "Cloning…" : "Clone"}
        </button>
        <Msg s={clone} />
      </form>
      <form
        className="space-y-3 rounded-lg border border-line p-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (!up.file) return;
          void doUpload(async () => {
            await atlas.upload(up.ws, up.file!);
            onChange();
            return "Uploaded. Nothing ran: start the pipeline when ready.";
          });
        }}
      >
        <Label as="h3">Upload a .zip</Label>
        <label className="block text-small text-fg-2">
          Into workspace
          <select
            className={field}
            value={up.ws}
            onChange={(e) => setUp({ ...up, ws: e.target.value })}
            required
          >
            {writable.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
        </label>
        <label className="block text-small text-fg-2">
          Archive
          <input
            className="block w-full text-small text-fg-2"
            type="file"
            accept=".zip,application/zip"
            onChange={(e) => setUp({ ...up, file: e.target.files?.[0] ?? null })}
            required
          />
        </label>
        <button type="submit" disabled={upload.busy || !up.ws || !up.file} className={btn}>
          {upload.busy ? "Uploading…" : "Upload"}
        </button>
        <Msg s={upload} />
      </form>
    </div>
  );
}

export function AtlasHome() {
  const me = useAtlasMe();
  const list = useAtlas(me.user ? `workspaces:${me.user.username}` : null, (signal) =>
    atlas.workspaces({ signal }),
  );
  const qs = useAtlas(me.user ? "quantum-status" : null, (signal) =>
    atlas.quantumStatus({ signal }),
  );
  if (me.error) return <AtlasErrorPanel error={me.error} onRetry={me.reload} />;
  if (me.loading && !me.data) return <Skeleton className="h-console" />;
  if (!me.user)
    return (
      <Part title="Start with the public demo" label="read-only snapshot">
        <div className="flex flex-wrap gap-3">
          <Link prefetch={false} href="/atlas/demo/detect" className={btn}>
            Open the demo workspace
          </Link>
          <Link
            prefetch={false}
            href="/atlas/signin?next=/atlas"
            className="h-10 rounded-sm border border-line px-4 py-3 font-mono text-micro uppercase text-fg-2 hover:text-fg"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-4 text-small text-fg-3">
          Accounts are created by an Atlas admin: python -m atlas_web create-user --role operator.
        </p>
      </Part>
    );
  return (
    <>
      <Part
        title="Workspaces"
        label={`${me.user.username} · ${me.user.role}`}
        aside={
          <button
            type="button"
            onClick={() => void atlas.logout().then(me.reload, me.reload)}
            className="h-10 rounded-sm border border-line px-4 font-mono text-micro uppercase text-fg-2 hover:text-fg"
          >
            Sign out
          </button>
        }
      >
        {list.error ? (
          <AtlasErrorPanel error={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <Skeleton className="h-stage-sm" />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {list.data.workspaces.map((w) => (
              <li key={w.id}>
                <Link
                  prefetch={false}
                  href={`/atlas/${encodeURIComponent(w.id)}/detect`}
                  className="block rounded-lg border border-line p-4 hover:border-line-strong"
                >
                  <span className="text-body text-fg">{w.name}</span>
                  <span className="mt-1 block font-mono text-micro uppercase text-fg-3">
                    {w.id}
                    {w.read_only ? " · read-only" : ""} ·{" "}
                    {w.assets === null || w.assets === undefined
                      ? "not yet run"
                      : `${w.assets} systems`}
                    {w.last_run ? ` · last run ${w.last_run.status}` : ""}
                  </span>
                  {w.ledger_verified !== null && w.ledger_verified !== undefined && (
                    <span className="mt-2 inline-block">
                      <Chip status={w.ledger_verified ? "PASS" : "FAIL"}>
                        {w.ledger_verified ? "ledger verified" : "ledger not verified"}
                      </Chip>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Part>
      {me.canOperate && list.data && (
        <Part title="Bring your own source" label="operator">
          <OperatorTools
            ids={list.data.workspaces.map((w) => w.id)}
            templates={list.data.templates}
            onChange={list.reload}
          />
        </Part>
      )}
      <Part title="Paid QpiAI runs" label={me.isAdmin ? "admin" : undefined}>
        {qs.data?.fallback_reason ? (
          <Honesty kind="blocked">{qs.data.fallback_reason}</Honesty>
        ) : qs.error ? (
          <AtlasErrorPanel error={qs.error} onRetry={qs.reload} />
        ) : (
          <p className="text-small text-fg-3">Checking the QpiAI backend…</p>
        )}
        <p className="mt-3 text-small text-fg-3">
          Platform and QCloud runs stay off in this app; every pipeline run uses free local solvers
          and simulators.
        </p>
      </Part>
    </>
  );
}
