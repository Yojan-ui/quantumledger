"use client";

/**
 * The Shield dashboard (/app): sign in with a password and a mandatory authenticator code, then add
 * sites, prove ownership with a DNS record, copy an install snippet, switch the defence mode, see live
 * numbers (including the share of quantum-safe connections), set alerts and download monthly reports.
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Code, Label, MiniStat, Panel, Text } from "@/components/ui";

type Stage = "out" | "enroll" | "otp" | "full";
type Mode = "off" | "monitor" | "protect" | "strict";
interface Site {
  id: string;
  domain: string;
  mode: Mode;
  verified: boolean;
  dns: { txt: { name: string; value: string }; cname: { name: string; value: string } };
  settings: { alertEmail?: string; alertWebhook?: string };
}
interface Metrics {
  totals: {
    requests: number;
    challenged: number;
    blocked: number;
    tlsConnections: number;
    pqShare: number | null;
  };
  events: {
    at: number;
    type: string;
    score: number;
    path: string;
    reasons: string[];
    monitorOnly: boolean;
  }[];
}

const MODES: { id: Mode; text: string }[] = [
  { id: "off", text: "Off: nothing is scored" },
  { id: "monitor", text: "Monitor: score and report, never block" },
  { id: "protect", text: "Protect: limit, challenge, then block" },
  { id: "strict", text: "Strict: the same steps at lower scores" },
];

const input =
  "h-10 min-w-0 rounded-sm border border-line bg-inset px-3 text-small text-fg outline-none placeholder:text-fg-3 focus:border-line-strong";

async function api<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = (await r.json().catch(() => ({}))) as T & { error?: { message: string } };
  if (!r.ok) throw new Error(j.error?.message ?? `Request failed (${r.status})`);
  return j;
}

function Err({ msg }: { msg?: string }) {
  return msg ? (
    <p className="mt-3 text-small text-danger" role="alert">
      {msg}
    </p>
  ) : null;
}

function SignIn({ onStage }: { onStage: (s: Stage) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [err, setErr] = useState<string>();
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErr(undefined);
    try {
      const r = await api<{ stage: Stage }>(`/api/app/${mode}`, {
        email: f.get("email"),
        password: f.get("password"),
      });
      onStage(r.stage);
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  return (
    <Panel className="max-w-text">
      <Label>{mode === "login" ? "Sign in" : "Create an account"}</Label>
      <form onSubmit={(e) => void submit(e)} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-small text-fg-2">
          Email
          <input name="email" type="email" required autoComplete="email" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-small text-fg-2">
          Password {mode === "signup" && <span className="text-fg-3">(12 characters or more)</span>}
          <input
            name="password"
            type="password"
            required
            minLength={mode === "signup" ? 12 : 1}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className={input}
          />
        </label>
        <Button variant="primary" type="submit">
          {mode === "login" ? "Continue" : "Create account"}
        </Button>
      </form>
      <Err msg={err} />
      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="mt-4 text-small text-fg-2 underline-offset-4 hover:text-fg hover:underline"
      >
        {mode === "login" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
    </Panel>
  );
}

function SecondFactor({
  stage,
  onStage,
}: {
  stage: "enroll" | "otp";
  onStage: (s: Stage) => void;
}) {
  const [setup, setSetup] = useState<{ secret: string; url: string }>();
  const [err, setErr] = useState<string>();
  useEffect(() => {
    if (stage === "enroll")
      api<{ secret: string; url: string }>("/api/app/totp/start", {}).then(setSetup, (e: Error) =>
        setErr(e.message),
      );
  }, [stage]);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(undefined);
    try {
      await api("/api/app/totp/verify", { code: new FormData(e.currentTarget).get("code") });
      onStage("full");
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  return (
    <Panel className="max-w-text">
      <Label>Two-factor sign-in</Label>
      {stage === "enroll" ? (
        <>
          <Text size="small" className="mt-3">
            Every account uses an authenticator app (1Password, Google Authenticator, Authy…). Add
            this key to it, then enter the 6-digit code it shows.
          </Text>
          {setup && (
            <>
              <Code type={false} code={setup.secret} className="mt-4" />
              <Text size="small" className="mt-2 text-fg-3">
                Or open{" "}
                <a href={setup.url} className="underline">
                  this link
                </a>{" "}
                on the phone that has the app.
              </Text>
            </>
          )}
        </>
      ) : (
        <Text size="small" className="mt-3">
          Enter the 6-digit code from your authenticator app.
        </Text>
      )}
      <form onSubmit={(e) => void submit(e)} className="mt-4 flex gap-2">
        <label htmlFor="code" className="sr-only">
          6-digit code
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoComplete="one-time-code"
          placeholder="123456"
          className={`${input} w-32 font-mono`}
        />
        <Button variant="primary" type="submit">
          Verify
        </Button>
      </form>
      <Err msg={err} />
    </Panel>
  );
}

function SiteView({ site, onChange }: { site: Site; onChange: () => void }) {
  const [m, setM] = useState<Metrics>();
  const [msg, setMsg] = useState<string>();
  const [key, setKey] = useState<string>();
  const load = useCallback(() => {
    api<Metrics>(`/api/app/sites/${site.id}/metrics`).then(setM, () => {});
  }, [site.id]);
  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);
  const verify = async () => {
    try {
      const r = await api<{
        ownership: { ok: boolean; reason?: string };
        routing: { ok: boolean };
      }>(`/api/app/sites/${site.id}/verify`, {});
      setMsg(
        r.ownership.ok
          ? r.routing.ok
            ? "Verified, and traffic is reaching Shield Edge."
            : "Ownership verified. Add the CNAME next; it can take a while to spread."
          : `Not yet: ${r.ownership.reason === "no_record" ? "no TXT record found" : r.ownership.reason === "mismatch" ? "the TXT record's value doesn't match" : "DNS couldn't be checked"}.`,
      );
      onChange();
    } catch (x) {
      setMsg((x as Error).message);
    }
  };
  const setMode = async (mode: Mode) => {
    await api(`/api/app/sites/${site.id}/settings`, { mode }).catch((x: Error) =>
      setMsg(x.message),
    );
    onChange();
  };
  const saveAlerts = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api(`/api/app/sites/${site.id}/settings`, {
        alertEmail: String(f.get("email") ?? ""),
        alertWebhook: String(f.get("webhook") ?? ""),
      });
      setMsg("Alert settings saved.");
      onChange();
    } catch (x) {
      setMsg((x as Error).message);
    }
  };
  const month = new Date().toISOString().slice(0, 7);
  const t = m?.totals;
  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-h3 font-medium text-fg">{site.domain}</h2>
          <Label tone={site.verified ? "strong" : "muted"}>
            {site.verified ? "Ownership verified" : "Not verified yet"}
          </Label>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
          <MiniStat value={t ? t.requests.toLocaleString() : "…"} label="Requests (30 d)" />
          <MiniStat
            value={t ? (t.pqShare === null ? "n/a" : `${(t.pqShare * 100).toFixed(1)}%`) : "…"}
            label="Quantum-safe TLS"
          />
          <MiniStat value={t ? t.tlsConnections.toLocaleString() : "…"} label="TLS connections" />
          <MiniStat value={t ? t.challenged.toLocaleString() : "…"} label="Challenged" />
          <MiniStat value={t ? t.blocked.toLocaleString() : "…"} label="Blocked" />
        </div>
        {t?.pqShare === null && (
          <Text size="small" className="mt-3 text-fg-3">
            The quantum-safe share needs Shield Edge in front (DNS or container). The middleware
            alone can&apos;t see TLS.
          </Text>
        )}
      </Panel>

      <Panel>
        <Label>1 · Prove you own it, then route it</Label>
        <Text size="small" className="mt-3">
          Add these at your DNS provider. The TXT record comes first.
        </Text>
        <Code
          type={false}
          code={`TXT   ${site.dns.txt.name}   "${site.dns.txt.value}"`}
          className="mt-3"
          wrap
        />
        <Code
          type={false}
          code={`CNAME ${site.dns.cname.name}   ${site.dns.cname.value}`}
          className="mt-2"
          wrap
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button onClick={verify}>Check DNS</Button>
          {msg && <Text size="small">{msg}</Text>}
        </div>
      </Panel>

      <Panel>
        <Label>2 · Or install it another way</Label>
        <Code
          type={false}
          className="mt-3"
          wrap
          code={`# Container (post-quantum TLS + defence)\ndocker run -p 443:8443 -p 80:8080 -v shield:/data \\\n  -e EDGE_ORIGIN=http://your-app:3000 -e EDGE_DOMAINS=${site.domain} \\\n  -e SHIELD_KEK=... -e ACME_EMAIL=you@${site.domain.replace(/^www\./, "")} quantumledger/shield`}
        />
        <Code
          type={false}
          className="mt-2"
          wrap
          code={`// One line in your app (defence only; PQ TLS needs the DNS route or the container)\nimport { shield } from "@qsetu/shield";\napp.use(shield({ siteKey: process.env.QSETU_SITE_KEY }));`}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            onClick={async () => {
              if (!confirm("Make a new site key? The old one stops working at once.")) return;
              setKey((await api<{ key: string }>(`/api/app/sites/${site.id}/key`, {})).key);
            }}
          >
            New site key
          </Button>
          {key && <Code type={false} code={`QSETU_SITE_KEY=${key}`} />}
        </div>
        {key && (
          <Text size="small" className="mt-2 text-warn">
            Copy it now: it isn&apos;t shown again.
          </Text>
        )}
      </Panel>

      <Panel>
        <Label>3 · Defence mode</Label>
        <div role="radiogroup" aria-label="Defence mode" className="mt-3 grid gap-2 md:grid-cols-2">
          {MODES.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={site.mode === o.id}
              onClick={() => void setMode(o.id)}
              className={`rounded-sm border px-3 py-2 text-left text-small ${site.mode === o.id ? "border-line-strong bg-raised text-fg" : "border-line text-fg-2 hover:text-fg"}`}
            >
              {o.text}
            </button>
          ))}
        </div>
        <Text size="small" className="mt-2 text-fg-3">
          New sites start in Monitor. &ldquo;Off&rdquo; is the emergency switch: it takes effect
          within a minute.
        </Text>
      </Panel>

      <Panel>
        <Label>4 · Alerts</Label>
        <form onSubmit={(e) => void saveAlerts(e)} className="mt-3 flex flex-col gap-2 md:flex-row">
          <input
            name="email"
            type="email"
            placeholder="alerts@yourcompany.com"
            defaultValue={site.settings.alertEmail ?? ""}
            className={`${input} flex-1`}
            aria-label="Alert email"
          />
          <input
            name="webhook"
            type="url"
            placeholder="https://hooks.slack.com/…"
            defaultValue={site.settings.alertWebhook ?? ""}
            className={`${input} flex-1`}
            aria-label="Alert webhook (https)"
          />
          <Button type="submit">Save</Button>
        </form>
        <Text size="small" className="mt-2 text-fg-3">
          Honeypot, trap-link, canary-key, block and fake-search-engine events alert at most once
          per type every 10 minutes.
        </Text>
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Label>Recent events</Label>
          <a
            className="text-small text-fg-2 underline-offset-4 hover:text-fg hover:underline"
            href={`/api/app/sites/${site.id}/report?month=${month}`}
          >
            Download {month} report (PDF)
          </a>
        </div>
        <ul className="mt-3 flex flex-col divide-y divide-line">
          {(m?.events ?? []).slice(0, 20).map((e, i) => (
            <li
              key={i}
              className="flex flex-wrap gap-x-4 gap-y-1 py-2 font-mono text-micro text-fg-2"
            >
              <span className="tabular text-fg-3">
                {new Date(e.at).toISOString().slice(5, 19).replace("T", " ")}
              </span>
              <span className="text-fg">
                {e.type}
                {e.monitorOnly ? " (monitor)" : ""}
              </span>
              <span>score {e.score}</span>
              <span className="min-w-0 truncate">{e.path}</span>
              <span className="text-fg-3">{e.reasons.join(" · ")}</span>
            </li>
          ))}
          {m && !m.events.length && (
            <li className="py-2 text-small text-fg-3">
              Nothing yet. Events appear here as Shield reports them.
            </li>
          )}
        </ul>
      </Panel>
    </div>
  );
}

function Sites() {
  const [sites, setSites] = useState<Site[]>();
  const [sel, setSel] = useState<string>();
  const [created, setCreated] = useState<{ domain: string; key: string }>();
  const [err, setErr] = useState<string>();
  const load = useCallback(() => {
    api<{ sites: Site[] }>("/api/app/sites").then(
      (r) => {
        setSites(r.sites);
        setSel((s) => s ?? r.sites[0]?.id);
      },
      (e: Error) => setErr(e.message),
    );
  }, []);
  useEffect(load, [load]);
  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setErr(undefined);
    try {
      const r = await api<{ site: Site; key: string }>("/api/app/sites", {
        domain: new FormData(form).get("domain"),
      });
      setCreated({ domain: r.site.domain, key: r.key });
      setSel(r.site.id);
      form.reset();
      load();
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  const site = sites?.find((s) => s.id === sel);
  return (
    <div className="grid gap-6 lg:grid-cols-demo">
      <div className="flex flex-col gap-3">
        <Label>Your sites</Label>
        <ul className="flex flex-col gap-1">
          {sites?.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSel(s.id)}
                aria-current={s.id === sel || undefined}
                className={`w-full truncate rounded-sm px-3 py-2 text-left text-small ${s.id === sel ? "bg-raised text-fg" : "text-fg-2 hover:text-fg"}`}
              >
                {s.domain} <span className="text-fg-3">· {s.mode}</span>
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={(e) => void add(e)} className="flex gap-2">
          <label htmlFor="domain" className="sr-only">
            Domain
          </label>
          <input
            id="domain"
            name="domain"
            required
            placeholder="www.example.com"
            className={`${input} flex-1`}
          />
          <Button type="submit">Add</Button>
        </form>
        <Err msg={err} />
        <button
          type="button"
          onClick={() => void api("/api/app/logout", {}).then(() => location.reload())}
          className="mt-4 self-start text-small text-fg-3 hover:text-fg"
        >
          Sign out
        </button>
      </div>
      <div className="min-w-0">
        {created && (
          <Panel className="mb-4 border-warn">
            <Label>Site key for {created.domain}</Label>
            <Code type={false} code={`QSETU_SITE_KEY=${created.key}`} className="mt-3" />
            <Text size="small" className="mt-2 text-warn">
              Copy it now: it isn&apos;t shown again. Keep it server-side.
            </Text>
          </Panel>
        )}
        {site ? (
          <SiteView key={site.id} site={site} onChange={load} />
        ) : (
          sites && <Text>Add your first site to begin.</Text>
        )}
      </div>
    </div>
  );
}

export function Dashboard({ initial }: { initial: Stage }) {
  const [stage, setStage] = useState<Stage>(initial);
  if (stage === "out") return <SignIn onStage={setStage} />;
  if (stage === "enroll" || stage === "otp")
    return <SecondFactor stage={stage} onStage={setStage} />;
  return <Sites />;
}
