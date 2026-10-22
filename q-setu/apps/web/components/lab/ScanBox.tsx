"use client";

import { useState } from "react";
import { Button, Panel } from "@/components/ui";
import { Copy } from "@/components/ui/Copy";
import type { EmailScan, WebScan } from "@/lib/lab/scan";
import type { Threat, Verdict } from "@/lib/lab/types";

type Result = { result: WebScan | EmailScan; probes: { threat: Threat; verdict?: Verdict }[] };

const LABEL = {
  safe: "Looks safe",
  suspicious: "Looks suspicious",
  attack: "Looks like an attack",
};
const RESPONSE = {
  allow: "let it through",
  slow: "slow it down",
  challenge: "ask it to prove it's a person",
  block: "block it",
};

function Row({
  ok,
  simple,
  technical,
}: {
  ok: boolean | "warn";
  simple: string;
  technical: string;
}) {
  const tone = ok === true ? "bg-ok" : ok === "warn" ? "bg-warn" : "bg-danger";
  return (
    <li className="flex gap-3 border-t border-line py-2 text-small text-fg-2">
      <span aria-hidden className={`mt-2 block h-dot w-dot shrink-0 rounded-full ${tone}`} />
      <span>
        <span className="sr-only">
          {ok === true ? "Good: " : ok === "warn" ? "Weak: " : "Missing: "}
        </span>
        <Copy simple={simple} technical={technical} />
      </span>
    </li>
  );
}

function WebResult({ r }: { r: WebScan }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Panel>
        <p className="font-mono text-label uppercase text-fg-3">
          <Copy simple="Readiness" technical="Readiness score" />
        </p>
        <p className="mt-2 text-h2 font-medium text-fg">
          {r.readiness}
          <span className="text-body text-fg-3">/100</span>
        </p>
        <p className="mt-1 text-small text-fg-2">
          <Copy
            simple="How ready this site's public connection is for quantum-safe security, from what anyone can see."
            technical={`TLS findings ${r.tls.score}/100 (grade ${r.tls.grade})${r.http ? " × 0.7 + security headers × 30" : ""}${r.tls.cached ? " · cached scan" : ""}`}
          />
        </p>
        <ul className="mt-4">
          <Row
            ok={r.tls.hybridPq}
            simple={
              r.tls.hybridPq
                ? "Uses quantum-safe encryption for connections."
                : "Doesn't use quantum-safe encryption yet: traffic recorded today could be read later."
            }
            technical={`Key exchange: ${r.tls.group || "unknown"} (${r.tls.hybridPq ? "hybrid ML-KEM" : "classical"}) · ${r.tls.protocol ?? "?"}`}
          />
          <Row
            ok={/RSA|ECDSA|P-256|P-384/.test(r.tls.certKey) ? "warn" : true}
            simple="Its certificate uses today's (not yet quantum-safe) signatures, like almost every site."
            technical={`Certificate key: ${r.tls.certKey}`}
          />
          {r.tls.plain.slice(0, 2).map((p) => (
            <Row key={p} ok="warn" simple={p} technical={p} />
          ))}
        </ul>
      </Panel>
      <Panel>
        <p className="font-mono text-label uppercase text-fg-3">
          <Copy simple="What a visitor can see" technical="Home page: headers and surface" />
        </p>
        {r.http ? (
          <>
            <ul className="mt-3">
              {r.http.headers.map((h) => (
                <Row
                  key={h.name}
                  ok={h.present}
                  simple={`${h.plain}: ${h.present ? "yes" : "no"}`}
                  technical={`${h.name}: ${h.present ? "present" : "absent"}`}
                />
              ))}
            </ul>
            <p className="mt-4 text-small text-fg-2">
              <Copy
                simple={
                  r.http.login.length
                    ? `Visible login pages: ${r.http.login.join(", ")}. Automated attackers try these first.`
                    : "No login page linked from the home page."
                }
                technical={`Login surface: ${r.http.login.join(", ") || "none linked"}`}
              />
            </p>
            <p className="mt-2 text-small text-fg-2">
              <Copy
                simple={
                  r.http.api.length
                    ? `Visible API addresses: ${r.http.api.join(", ")}.`
                    : "No API addresses linked from the home page."
                }
                technical={`API surface: ${r.http.api.join(", ") || "none linked"} · HTTP ${r.http.status}${r.http.redirect ? ` → ${r.http.redirect}` : ""}`}
              />
            </p>
          </>
        ) : (
          <p className="mt-3 text-small text-fg-2">{r.httpNote}</p>
        )}
      </Panel>
    </div>
  );
}

function EmailResult({ r }: { r: EmailScan }) {
  const tone =
    r.spoofable === "protected"
      ? "text-ok"
      : r.spoofable === "partly"
        ? "text-warn"
        : "text-danger";
  return (
    <Panel>
      <p className="font-mono text-label uppercase text-fg-3">
        <Copy
          simple={`Can someone fake email from @${r.domain}?`}
          technical={`Email authentication for ${r.domain}`}
        />
      </p>
      <p className={`mt-2 text-h3 font-medium ${tone}`}>
        <Copy
          simple={
            r.spoofable === "protected"
              ? "Hard to fake"
              : r.spoofable === "partly"
                ? "Partly protected"
                : "Easy to fake"
          }
          technical={`DMARC ${r.dmarc ? `p=${r.dmarc.policy}` : "missing"}`}
        />
      </p>
      <p className="mt-2 max-w-prose text-body text-fg-2">{r.plain}</p>
      <ul className="mt-4">
        <Row
          ok={r.mx.length > 0}
          simple={
            r.mx.length
              ? `Receives email (${r.mx.length} mail server${r.mx.length === 1 ? "" : "s"}).`
              : "No mail servers listed."
          }
          technical={`MX: ${r.mx.join(", ") || "none"}`}
        />
        <Row
          ok={r.spf ? (r.spf.strength === "strict" ? true : "warn") : false}
          simple={
            r.spf
              ? r.spf.strength === "strict"
                ? "Lists exactly which servers may send its email, and rejects the rest."
                : "Lists which servers may send its email, but only softly."
              : "Doesn't list which servers may send its email."
          }
          technical={`SPF: ${r.spf?.record ?? "missing"}`}
        />
        <Row
          ok={r.dkim.length > 0 ? true : "warn"}
          simple={
            r.dkim.length
              ? "Signs its outgoing email."
              : "No email signature found at the usual places (it may use others)."
          }
          technical={`DKIM selectors found: ${r.dkim.join(", ") || "none of default, google, selector1/2, k1, s1/2, mail, dkim"}`}
        />
        <Row
          ok={r.dmarc ? (r.dmarc.policy === "reject" ? true : "warn") : false}
          simple={
            r.dmarc
              ? `Tells mail servers what to do with fakes: ${r.dmarc.policy === "reject" ? "reject them" : r.dmarc.policy === "quarantine" ? "send them to spam" : "nothing"}.`
              : "Gives mail servers no instruction about fakes."
          }
          technical={`DMARC: ${r.dmarc?.record ?? "missing"}`}
        />
      </ul>
    </Panel>
  );
}

/** "Scan a site": a read-only check of a public website or an email domain. */
export function ScanBox({ suggested }: { suggested: string[] }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Result>();
  const [error, setError] = useState<string>();
  const run = async (value: string) => {
    setBusy(true);
    setError(undefined);
    try {
      const r = await fetch("/api/lab/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: value }),
      });
      const j = (await r.json()) as Result & { error?: { message: string } };
      if (!r.ok) {
        setData(undefined);
        setError(j.error?.message ?? "Couldn't run the check.");
      } else setData(j);
    } catch {
      setError("Couldn't run the check.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      aria-labelledby="lab-scan"
      className="mb-10 rounded-lg border border-line bg-raised p-6 md:p-8"
    >
      <h2 id="lab-scan" className="text-h3 font-medium text-fg">
        <Copy simple="Scan a site" technical="Passive readiness check" />
      </h2>
      <p className="mt-2 max-w-prose text-body text-fg-2">
        <Copy
          simple="Enter a website or an email address. We read only what's public (its secure connection, the headers its home page sends, its email records) and never attack it."
          technical="Website: TLS handshake (DNS-pinned, public IPs only) + one GET / (no redirects, 5 s, 300 KB). Email: MX, SPF, DKIM (common selectors), DMARC via DNS. No probe traffic is sent to third parties."
        />
      </p>
      <form
        className="mt-4 flex flex-col gap-3 md:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) void run(input.trim());
        }}
      >
        <label className="sr-only" htmlFor="lab-scan-input">
          Website or email address
        </label>
        <input
          id="lab-scan-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="example.com or someone@example.com"
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-sm border border-line-strong bg-base px-3 text-body text-fg"
        />
        <Button variant="primary" type="submit" disabled={busy || !input.trim()}>
          {busy ? "Checking…" : "Check"}
        </Button>
      </form>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-small text-fg-3">
        <Copy simple="Works offline:" technical="Cached (offline) examples:" />
        {suggested.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setInput(s);
              void run(s);
            }}
            className="rounded-sm border border-line px-2 py-1 font-mono text-label text-fg-2 transition-colors duration-150 hover:text-fg"
          >
            {s}
          </button>
        ))}
      </p>
      {error && (
        <p role="status" className="mt-4 text-small text-danger">
          {error}
        </p>
      )}
      {data && (
        <div className="mt-6" role="status">
          <p className="mb-4 text-small text-fg-3">
            <Copy
              simple={`Results for ${data.result.kind === "email" ? `@${data.result.domain}` : data.result.host}. This is an analysis of public signals, not an attack.`}
              technical={`${data.result.kind === "email" ? data.result.domain : data.result.host} · passive check`}
            />
          </p>
          {data.result.kind === "website" ? (
            <WebResult r={data.result} />
          ) : (
            <EmailResult r={data.result} />
          )}
          {data.probes.length > 0 && (
            <div className="mt-6">
              <h3 className="text-body font-medium text-fg">
                <Copy
                  simple="What an AI-agent attacker would probe here"
                  technical="Likely agent behaviour (reference library) and model scores"
                />
              </h3>
              <ul className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
                {data.probes.map((p) => (
                  <li key={p.threat.id} className="rounded-lg border border-line p-4">
                    <p className="text-small font-medium text-fg">{p.threat.title}</p>
                    <p className="mt-1 text-small text-fg-2">
                      <Copy
                        simple={`They'd try: ${p.threat.seen.join("; ")}.`}
                        technical={p.threat.seen.join(" · ")}
                      />
                    </p>
                    {p.verdict && (
                      <p className="mt-2 text-small text-ok">
                        <Copy
                          simple={`Our model would say "${LABEL[p.verdict.label]}" (risk ${Math.round(p.verdict.score * 100)}/100) and ${RESPONSE[p.verdict.response]}${
                            p.verdict.reasons[0]
                              ? `, because it ${p.verdict.reasons
                                  .map((x) => x.text)
                                  .slice(0, 2)
                                  .join(" and ")}`
                              : ""
                          }.`}
                          technical={`Model ${p.verdict.version}: ${p.verdict.label} ${p.verdict.score.toFixed(2)} → ${p.verdict.response}; ${p.verdict.reasons.map((x) => x.feature).join(", ")}`}
                        />
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
