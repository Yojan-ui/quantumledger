import type { ReactNode } from "react";
import { Container, Label } from "@/components/ui";
import type { LabUser } from "@/lib/lab/auth";
import type { Phase } from "@/lib/lab/types";
import { Copy } from "@/components/ui/Copy";
import { ACTION_WORDS, danger, PHASE_WORDS } from "@/lib/lab/words";
import { AutoRefresh, LabTabs, LabWorkflow, ScopeSelect, SignOut } from "./client";

/** The Lab's page frame, inside the site's own nav and footer. */
export function LabFrame({
  user,
  customers,
  scopeName,
  title,
  lead,
  actions,
  children,
}: {
  user: LabUser;
  customers: { id: string; name: string }[];
  /** What the page is showing: "All customers" or one customer's name. */
  scopeName: string;
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const team = user.role === "team";
  return (
    <Container className="py-16 md:py-24">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <LabTabs team={team} />
        <div className="flex flex-wrap items-center gap-4">
          {team && <ScopeSelect customers={customers} />}
          <span className="text-small text-fg-3">
            {user.email} · {team ? "team" : "customer"}
          </span>
          <SignOut />
        </div>
      </div>
      <LabWorkflow />
      <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <Label>Lab · {scopeName}</Label>
          <h1 className="mt-3 text-h1-sm font-medium text-fg md:text-h2">{title}</h1>
          {lead && <p className="mt-3 max-w-prose text-body text-fg-2">{lead}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-10">{children}</div>
    </Container>
  );
}

/** What Shield did with a request: refused is protected (ok), let through is plain. */
export function ActionChip({ action }: { action: string }) {
  const label =
    action === "allow"
      ? "allowed"
      : action === "limit"
        ? "limited"
        : action === "challenge"
          ? "challenged"
          : "blocked";
  return (
    <Chip tone={action === "allow" ? "fg-2" : "ok"}>
      <Copy simple={ACTION_WORDS[action] ?? label} technical={label} />
    </Chip>
  );
}

export const PHASE: Record<Phase, { label: string; tone: Tone }> = {
  browse: { label: "browse", tone: "fg-3" },
  recon: { label: "recon", tone: "fg-2" },
  probe: { label: "probe", tone: "warn" },
  credential: { label: "credential", tone: "danger" },
  abuse: { label: "abuse", tone: "danger" },
  blocked: { label: "refused", tone: "ok" },
};

type Tone = "ok" | "warn" | "danger" | "sig" | "fg-2" | "fg-3";
const TEXT: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  sig: "text-sig",
  "fg-2": "text-fg-2",
  "fg-3": "text-fg-3",
};
const BG: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  sig: "bg-sig",
  "fg-2": "bg-fg-2",
  "fg-3": "bg-fg-3",
};

export function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-sm border border-line px-2 py-1 font-mono text-label uppercase ${TEXT[tone]}`}
    >
      <span aria-hidden className={`block h-dot w-dot rounded-full ${BG[tone]}`} />
      {children}
    </span>
  );
}

export function PhaseChip({ phase }: { phase: Phase }) {
  return (
    <Chip tone={PHASE[phase].tone}>
      <Copy simple={PHASE_WORDS[phase]} technical={PHASE[phase].label} />
    </Chip>
  );
}

/** A 0–100 risk score as a thin bar in the matching role colour. */
export function Score({ n }: { n: number }) {
  const tone: Tone = n >= 80 ? "danger" : n >= 30 ? "warn" : "fg-3";
  return (
    <span className={`inline-flex items-center gap-2 ${TEXT[tone]}`}>
      <span className="block h-1 w-20 overflow-hidden rounded-full bg-line">
        <span
          className={`block h-full ${BG[tone]}`}
          style={{ width: `${Math.max(0, Math.min(100, n))}%` }}
        />
      </span>
      <span className="tabular font-mono text-small">
        <Copy simple={`Danger: ${danger(n)}`} technical={n} />
      </span>
    </span>
  );
}

/** The engine isn't answering yet (it starts with `pnpm demo`): a friendly card that retries itself. */
export function EngineOffline() {
  return (
    <div
      role="status"
      className="rounded-lg border border-line bg-raised p-6 text-body text-fg-2 md:p-8"
    >
      <p className="font-mono text-label uppercase text-kem">Starting the Lab…</p>
      <p className="mt-3 max-w-prose">
        The attack recorder is warming up. This page checks again every few seconds and fills in by
        itself.
      </p>
      <AutoRefresh seconds={3} />
    </div>
  );
}

export function ago(t: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86_400)}d ago`;
}

export function dur(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 60_000)} min`;
}
