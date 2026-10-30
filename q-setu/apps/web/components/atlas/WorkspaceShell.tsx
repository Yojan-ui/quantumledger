"use client";

/**
 * Frame for /atlas/[ws]/*: workspace header (name, read-only badge, who is signed in), the seven flow
 * steps as tabs in Atlas's order, a "Run in HUD" link to /diagnostics?ws=…, and "Open report" (Atlas's
 * report.html keeps its own CSP: it opens as its own page, never injected into React).
 */
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/layout";
import { Label } from "@/components/ui/type";
import { atlas } from "@/lib/client/atlas";
import { useAtlas, useAtlasMe } from "@/lib/client/useAtlas";
import { AtlasErrorPanel } from "./AtlasUI";

/** The seven user-facing steps (contracts/stages.json `flow`), each with its page here. */
export const FLOW_PAGES = [
  { slug: "detect", label: "Detect" },
  { slug: "inventory", label: "Inventory & drift" },
  { slug: "schedule", label: "Plan" },
  { slug: "handshakes", label: "Handshake gates" },
  { slug: "qaoa", label: "Wave selection" },
  { slug: "ledger", label: "Proof Chain" },
  { slug: "review", label: "Review" },
] as const;

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { ws } = useParams<{ ws: string }>();
  const path = usePathname();
  const me = useAtlasMe();
  // GET /workspaces/<ws> needs a session; signed out (the public demo) the id stands in for the name.
  const info = useAtlas(me.user ? `ws:${ws}:${me.user.username}` : null, (signal) =>
    atlas.workspace(ws, { signal }),
  );
  return (
    <Container className="py-12 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label>
            <Link prefetch={false} href="/atlas" className="hover:text-fg">
              Q-Shield
            </Link>{" "}
            / workspace
          </Label>
          <h1 className="mt-2 text-h1-sm font-medium text-fg">{info.data?.name ?? ws}</h1>
          <p className="mt-1 font-mono text-micro uppercase text-fg-3">
            {ws}
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
      <nav
        aria-label="Pipeline steps"
        className="mt-8 max-w-full overflow-x-auto border-b border-line"
      >
        <ol className="flex min-w-max gap-1">
          {FLOW_PAGES.map((p, i) => {
            const href = `/atlas/${encodeURIComponent(ws)}/${p.slug}`;
            const on = path === href;
            return (
              <li key={p.slug}>
                <Link
                  prefetch={false}
                  href={href}
                  aria-current={on ? "page" : undefined}
                  className={`block border-b px-3 py-3 font-mono text-micro uppercase ${on ? "border-fg text-fg" : "border-transparent text-fg-3 hover:text-fg"}`}
                >
                  {i + 1} {p.label}
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
        <div className="mt-2">{children}</div>
      )}
    </Container>
  );
}
