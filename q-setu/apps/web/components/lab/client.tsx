"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

const TABS = [
  { href: "/lab", label: "Overview", team: false },
  { href: "/lab/incidents", label: "Incidents", team: false },
  { href: "/lab/patterns", label: "Patterns", team: false },
  { href: "/lab/model", label: "Threat model", team: false },
  { href: "/lab/replay", label: "Replay", team: true },
];

/** The Lab's section tabs; they keep the team's customer filter. */
export function LabTabs({ team }: { team: boolean }) {
  const path = usePathname();
  const customer = useSearchParams().get("customer");
  const qs = customer ? `?customer=${encodeURIComponent(customer)}` : "";
  return (
    <nav aria-label="Lab" className="flex flex-wrap gap-1">
      {TABS.filter((t) => team || !t.team).map((t) => {
        const on = t.href === "/lab" ? path === "/lab" : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={`${t.href}${qs}`}
            aria-current={on ? "page" : undefined}
            className={`rounded-sm px-3 py-2 text-small transition-colors duration-150 ${on ? "bg-raised text-fg" : "text-fg-2 hover:text-fg"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** The team's customer filter: every customer, or one. */
export function ScopeSelect({ customers }: { customers: { id: string; name: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  const value = useSearchParams().get("customer") ?? "";
  return (
    <label className="flex items-center gap-2 text-small text-fg-2">
      <span className="font-mono text-label uppercase text-fg-3">Customer</span>
      <select
        value={value}
        onChange={(e) =>
          router.push(
            e.target.value ? `${path}?customer=${encodeURIComponent(e.target.value)}` : path,
          )
        }
        className="h-10 max-w-full rounded-sm border border-line-strong bg-raised px-3 text-small text-fg"
      >
        <option value="">All customers</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SignOut() {
  const router = useRouter();
  return (
    <Button
      onClick={async () => {
        await fetch("/api/lab/auth/sign-out", { method: "POST" });
        router.push("/lab/sign-in");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}

/** Re-reads the server-rendered page every `seconds` while the tab is visible. */
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

/** Team only: asks the engine to send labelled test traffic to its loopback sandbox. */
export function SendTestTraffic() {
  const router = useRouter();
  const [note, setNote] = useState<string>();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        onClick={async () => {
          const r = await fetch("/api/lab/simulate", { method: "POST" });
          if (!r.ok) throw new Error("The engine is busy or offline");
          setNote("Sending to the local sandbox; new incidents appear in a few seconds.");
          setTimeout(() => router.refresh(), 4000);
        }}
      >
        Send test traffic
      </Button>
      {note && <span className="text-small text-fg-3">{note}</span>}
    </div>
  );
}
