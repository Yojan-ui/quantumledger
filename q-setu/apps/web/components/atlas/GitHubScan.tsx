"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { atlas, type ManifestsResponse } from "@/lib/client/atlas";
import { cloneGitHub, githubRepo, intakeError } from "@/lib/client/github-intake";
import { useAtlasMe } from "@/lib/client/useAtlas";
import { Button } from "@/components/ui";
import { Details } from "./AtlasUI";

export function GitHubScan() {
  const me = useAtlasMe();
  const router = useRouter();
  const locked = useRef(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{ id: string; manifests: ManifestsResponse } | null>(null);
  const launch = async (id: string) => {
    setMessage("Starting the pipeline…");
    const { run_id } = await atlas.startRun(id);
    router.push(`/atlas/${encodeURIComponent(id)}?run=${encodeURIComponent(run_id)}`);
  };
  const scan = async () => {
    if (locked.current) return;
    setError("");
    try {
      githubRepo(url);
    } catch (e) {
      setError(intakeError(e));
      return;
    }
    if (!me.canOperate) {
      setError("Sign in with an Atlas operator account to scan a repository.");
      return;
    }
    locked.current = true;
    setBusy(true);
    setPending(null);
    try {
      const { id, source } = await cloneGitHub(url, setMessage);
      setMessage(`Cloned ${source.files} files at ${source.commit.slice(0, 12)}.`);
      let manifests = await atlas.manifests(id);
      if (!manifests.services.length) manifests = await atlas.suggestManifests(id);
      if (!manifests.services.length)
        throw new Error(
          "No service directories were found. Add atlas-service.json manifests to the repository before scanning for a migration plan.",
        );
      if (manifests.services.some((s) => s.manifest?.suggested || s.error)) {
        setPending({ id, manifests });
        setMessage("Source cloned. Review the service assumptions below before planning.");
      } else await launch(id);
    } catch (e) {
      setError(intakeError(e));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const confirm = async () => {
    if (!pending || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await atlas.confirmManifests(pending.id);
      await launch(pending.id);
    } catch (e) {
      setError(intakeError(e));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  return (
    <section id="github" className="scroll-mt-16 space-y-3 rounded-lg border border-line p-4">
      <h2 className="text-h3 font-medium text-fg">Scan a GitHub repo</h2>
      <p className="text-small text-fg-2">
        Public source only. A new workspace keeps your scan separate from the bank demo.
      </p>
      <form
        className="flex flex-col gap-3 md:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void scan();
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Public GitHub repository URL</span>
          <input
            aria-describedby="github-help"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            type="url"
            required
            placeholder="https://github.com/owner/repo"
            autoComplete="off"
            disabled={busy}
            className="h-10 w-full rounded-sm border border-line bg-inset px-3 text-body text-fg"
          />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Working…" : "Clone and run"}
        </Button>
      </form>
      <p id="github-help" className="text-small text-fg-3">
        No access tokens. Static scanning never executes repository code. Planning needs service
        manifests; inferred ownership and data classes require your confirmation.
      </p>
      {!me.loading && !me.user && (
        <Link
          href="/atlas/signin?next=/atlas/demo%23github"
          className="inline-block text-small underline underline-offset-4"
        >
          Sign in to scan
        </Link>
      )}
      {me.error && (
        <p role="alert" className="text-small text-danger">
          {intakeError(me.error)}
        </p>
      )}
      {message && (
        <p role="status" className="break-words text-small text-fg-2">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      )}
      {pending && (
        <Details summary="Review suggested service assumptions">
          <p>
            {pending.manifests.label} These are suggestions, not facts about the repository. Confirm
            only if they match your systems.
          </p>
          <ul className="space-y-2">
            {pending.manifests.services.map((s) => (
              <li key={s.dir} className="break-words">
                <strong>{s.dir}</strong>:{" "}
                {s.error ?? `${s.manifest?.name} · ${s.manifest?.kind} · ${s.manifest?.data_class}`}
              </li>
            ))}
          </ul>
          <Button
            disabled={busy || pending.manifests.services.some((s) => !!s.error)}
            onClick={() => void confirm()}
          >
            Confirm assumptions and run
          </Button>
          <p>
            To change these values, update the repository’s atlas-service.json files and scan again.
          </p>
        </Details>
      )}
    </section>
  );
}
