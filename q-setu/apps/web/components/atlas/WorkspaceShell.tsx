"use client";

/**
 * Frame for /atlas/[ws]/*: workspace header (name, read-only badge, who is signed in), the seven flow
 * steps as tabs in Atlas's order, a "Run in HUD" link to /diagnostics?ws=…, and "Open report" (Atlas's
 * report.html keeps its own CSP: it opens as its own page, never injected into React).
 */
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/layout";
import { Label } from "@/components/ui/type";
import { atlas } from "@/lib/client/atlas";
import { FLOW } from "@/lib/client/atlas-flow";
import { useAtlas, useAtlasMe } from "@/lib/client/useAtlas";
import { AboutPipeline, StageDetails } from "./AboutPipeline";
import { AtlasErrorPanel } from "./AtlasUI";

/**
 * The tabs, in the original Atlas sidebar order: Overview, then the seven steps (Detect with its Inventory &
 * drift sub-page; the Proof Chain appears twice, as step 2 and step 6, like Atlas's ?section=2 / ?section=6).
 */
const TABS: { href: string; label: string; n?: number }[] = [
  { href: "", label: "Pipeline" },
  ...FLOW.map((f, i) => ({ href: f.href, label: f.label, n: i + 1 })),
];

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { ws } = useParams<{ ws: string }>();
  const path = usePathname();
  const section = useSearchParams().get("section");
  const me = useAtlasMe();
  // GET /workspaces/<ws> needs a session; signed out (the public demo) the id stands in for the name.
  const info = useAtlas(me.user ? `ws:${ws}:${me.user.username}` : null, (signal) =>
    atlas.workspace(ws, { signal }),
  );
  return (
    <Container className="py-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label>
            <Link prefetch={false} href="/atlas" className="hover:text-fg">
              Q-Shield
            </Link>{" "}
            / workspace
          </Label>
          <h1 className="mt-2 text-h1-sm font-medium text-fg">
            {ws === "demo" ? "Bank migration pipeline" : (info.data?.name ?? ws)}
          </h1>
          <p className="mt-1 font-mono text-micro uppercase text-fg-3">
            {ws === "demo" ? "Fictional bank · real local scan and TLS lab evidence" : ws}
            {info.data?.read_only ? " · read-only snapshot" : ""}
            {me.user ? ` · ${me.user.username} (${me.user.role})` : " · not signed in"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            prefetch={false}
            href={`/diagnostics?ws=${encodeURIComponent(ws)}`}
            className="flex h-10 items-center rounded-sm border border-line-strong px-4 font-mono text-micro uppercase text-fg hover:bg-raised"
          >
            Pipeline HUD
          </Link>
          <a
            href={atlas.reportUrl(ws)}
            target="_blank"
            rel="noopener"
            className="flex h-10 items-center rounded-sm border border-line px-4 font-mono text-micro uppercase text-fg-2 hover:text-fg"
          >
            Open report
          </a>
          {!me.user && (
            <Link
              prefetch={false}
              href={`/atlas/signin?next=${encodeURIComponent(path)}`}
              className="flex h-10 items-center rounded-sm border border-line px-4 font-mono text-micro uppercase text-fg-2 hover:text-fg"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
      <AboutPipeline ws={ws} />
      <nav
        aria-label="Pipeline steps"
        className="mt-8 max-w-full overflow-x-auto border-b border-line"
      >
        <ol className="flex min-w-max gap-1 lg:min-w-0 lg:flex-wrap">
          {TABS.map((t) => {
            const [page, query] = t.href.split("?");
            const href = `/atlas/${encodeURIComponent(ws)}${page ? `/${page}` : ""}${query ? `?${query}` : ""}`;
            const want = query ? new URLSearchParams(query).get("section") : null;
            const on =
              path === `/atlas/${encodeURIComponent(ws)}${page ? `/${page}` : ""}` &&
              (want === null ? !section : section === want);
            return (
              <li key={t.href || "overview"}>
                <Link
                  prefetch={false}
                  href={href}
                  aria-current={on ? "page" : undefined}
                  className={`block border-b px-3 py-3 font-mono text-micro uppercase ${on ? "border-fg text-fg" : "border-transparent text-fg-3 hover:text-fg"}`}
                >
                  {t.n ? `${t.n} ` : ""}
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
      {info.error && info.error.status !== 401 && info.error.status !== 403 ? (
        <div className="mt-8">
          <AtlasErrorPanel error={info.error} onRetry={info.reload} />
        </div>
      ) : (
        <div className="mt-2">
          <StageDetails
            href={`${path.split("/").slice(3).join("/")}${section ? `?section=${section}` : ""}`}
          />
          {children}
        </div>
      )}
    </Container>
  );
}
