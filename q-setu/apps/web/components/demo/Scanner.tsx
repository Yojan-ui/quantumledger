"use client";

import type { ScanResult, Severity } from "@qsetu/core";
import { SCAN_SAMPLES } from "@qsetu/core/samples";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { StagePurpose } from "@/components/demo/shell/StagePurpose";
import { LazyView } from "@/components/scenes/LazyView";
import { Button, Code, Heading, Label, MiniStat, Stat, Text } from "@/components/ui";
import { errText } from "@/lib/client/api";
import { usePresent } from "@/lib/client/present";
import { useReducedMotion } from "@/lib/client/motion";
import type { Plan } from "@/lib/live/plan";

const ScannerBars = dynamic(() => import("./ScannerBars"), { ssr: false, loading: () => null });

const LIFETIMES = [1, 5, 10, 25] as const;

/** Severity is a dot, not a coloured pill: saffron only for findings that are harvestable or broken. */
const SEVERITY_DOT: Record<Severity, string> = {
  critical: "text-warn",
  high: "text-warn",
  medium: "text-fg-2",
  low: "text-fg-3",
  info: "text-fg-3",
};

export function Scanner() {
  const [sampleId, setSampleId] = useState(SCAN_SAMPLES[0]!.id);
  const [text, setText] = useState(SCAN_SAMPLES[0]!.text);
  const [filename, setFilename] = useState(SCAN_SAMPLES[0]!.filename);
  const [result, setResult] = useState<ScanResult>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  // The host being probed: its result line's slot is held from the click (no shift when it lands).
  const [probing, setProbing] = useState<string>();
  const [url, setUrl] = useState("https://www.google.com");
  const [probe, setProbe] = useState<{
    host: string;
    protocol: string;
    cipher: string;
    group: string;
    hybridPq: boolean;
    certKey: string;
    issuer: string;
  }>();
  const [lifetime, setLifetime] = useState<number>(10);
  const [plan, setPlan] = useState<Plan & { markdown: string }>();
  const [done, setDone] = useState<Set<string>>(new Set());
  // When the latest result arrived: its bars grow from then (the scan itself is the beat).
  const [resultAt, setResultAt] = useState(0);
  useEffect(() => {
    if (result) setResultAt(performance.now());
  }, [result]);
  const reduce = useReducedMotion();

  // /demo/scanner?url=host#url (the hero's "Scan your site" link) focuses the URL field and runs it.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("url");
    if (window.location.hash === "#url") document.getElementById("scan-url")?.focus();
    if (q) {
      setUrl(q);
      void scanUrl(q);
    } else void run(); // land on a real result: the default sample, scanned now

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every scan (live URL or pasted text) becomes an ordered migration plan.
  useEffect(() => {
    if (!result) return setPlan(undefined);
    let live = true;
    void fetch("/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        findings: result.findings.map(
          ({ ruleId, line, algorithm, primitive, severity, quantumVulnerable, match }) => ({
            ruleId,
            line,
            algorithm,
            primitive,
            severity,
            quantumVulnerable,
            match,
          }),
        ),
        dataLifetimeYears: lifetime,
        source: probe ? "url" : "code",
        hybridPq: probe?.hybridPq,
      }),
    })
      // An error reply (a 429, a 400) has no plan in it: keep the last plan rather than render one.
      .then((r) => (r.ok ? (r.json() as Promise<Plan & { markdown: string }>) : undefined))
      .then((p) => {
        if (!live || !p) return;
        setPlan(p);
        setDone(new Set());
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [result, lifetime, probe]);

  function downloadPlan() {
    if (!plan) return;
    const blob = new Blob([plan.markdown], { type: "text/markdown" });
    const href = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), {
      href,
      download: `migration-plan-${filename.replace(/\W+/g, "-")}.md`,
    }).click();
    // Revoked a moment later: revoking at once can cancel the download before it starts.
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  function choose(id: string) {
    const s = SCAN_SAMPLES.find((x) => x.id === id)!;
    setSampleId(id);
    setText(s.text);
    setFilename(s.filename);
    setResult(undefined);
  }

  async function scanUrl(target = url) {
    setBusy(true);
    setProbing(target);
    setError(undefined);
    try {
      const res = await fetch("/api/scan/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const data = (await res.json()) as ScanResult & {
        probe: NonNullable<typeof probe>;
        error?: unknown;
      };
      if (!res.ok) throw new Error(errText(data, `Scan failed (${res.status})`));
      setProbe(data.probe);
      setText((data.probe as unknown as { report: string }).report);
      setFilename(data.probe.host);
      setSampleId("");
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setProbing(undefined);
    }
  }

  async function run() {
    setBusy(true);
    setError(undefined);
    setProbe(undefined);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, filename }),
      });
      const data = (await res.json()) as ScanResult & { error?: unknown };
      if (!res.ok) throw new Error(errText(data, `Scan failed (${res.status})`));
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Presenter: → scans the URL field, ← and R clear the result.
  usePresent({
    next: () => !busy && void scanUrl(),
    prev: () => (setResult(undefined), setProbe(undefined)),
    reset: () => (setResult(undefined), setProbe(undefined)),
  });

  function downloadCbom() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result.cbom, null, 2)], {
      type: "application/vnd.cyclonedx+json",
    });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `cbom-${filename.replace(/\W+/g, "-")}.json`,
    });
    a.click();
    // Revoked a moment later: revoking at once can cancel the download before it starts.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const field =
    "h-10 min-w-0 rounded-sm border border-line bg-inset px-3 text-small text-fg outline-none transition-colors duration-150 placeholder:text-fg-3 focus:border-line-strong";
  return (
    <div data-present-target className="grid grid-cols-1 gap-12 lg:grid-cols-split">
      <div className="min-w-0 space-y-6">
        <form
          id="url"
          className="flex scroll-mt-24 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void scanUrl();
          }}
        >
          <label htmlFor="scan-url" className="sr-only">
            Website to scan
          </label>
          <input
            id="scan-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-bank.example"
            className={`${field} flex-1`}
          />
          <Button type="submit" disabled={busy || !url.trim()}>
            Scan live TLS
          </Button>
        </form>
        {probing && !probe && (
          <Code code={probing} copy={false} wrap>
            <span className="text-fg-3">
              Probing {probing.replace(/^https?:\/\//, "")}: TLS version, cipher, key exchange and
              certificate will appear here…
            </span>
          </Code>
        )}
        {probe && (
          <Code
            code={`${probe.host} ${probe.protocol} ${probe.cipher} ${probe.group} ${probe.certKey}`}
            copy={false}
            wrap
          >
            <span className="text-fg-2">
              <span className={probe.hybridPq ? "text-kem" : "text-warn"}>
                {probe.hybridPq ? "✓" : "✗"}
              </span>{" "}
              {probe.host}: {probe.protocol} · {probe.cipher} · key exchange{" "}
              <span className="text-fg">{probe.group}</span>{" "}
              {probe.hybridPq ? "(hybrid post-quantum)" : "(classical: harvestable today)"} ·
              certificate {probe.certKey}
              {probe.issuer && ` (${probe.issuer})`}
            </span>
          </Code>
        )}
        <div
          className="inline-flex flex-wrap rounded-sm border border-line p-1"
          role="group"
          aria-label="Sample inputs"
        >
          {SCAN_SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => choose(s.id)}
              aria-pressed={sampleId === s.id}
              className={`h-8 rounded-sm px-3 text-small transition-colors duration-150 ${sampleId === s.id ? "bg-raised text-fg" : "text-fg-3 hover:text-fg"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <label htmlFor="scan-input" className="sr-only">
          Text, config or code to scan
        </label>
        <textarea
          id="scan-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSampleId("");
            setFilename("pasted-input");
          }}
          spellCheck={false}
          className="h-stage-sm w-full resize-y rounded-sm border border-line bg-inset p-4 font-mono text-small text-fg-2 outline-none focus:border-line-strong"
          placeholder="Paste a config, certificate or source file…"
        />
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={run} disabled={busy || !text.trim()}>
            {busy ? "Scanning…" : "Scan"}
          </Button>
          <Button onClick={downloadCbom} disabled={!result}>
            Download CBOM
          </Button>
        </div>
        {error && <Text size="small">{error}</Text>}
      </div>

      <aside className="border-t border-line pt-8 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
        {result ? (
          <div className="space-y-8">
            <Stat value={`${result.score} / 100`} label={`Readiness · ${result.grade}`} />
            <div className="flex gap-8">
              {(["critical", "high", "medium"] as const).map((k) => (
                <MiniStat key={k} value={result.summary[k]} label={k} />
              ))}
            </div>
          </div>
        ) : (
          <Text size="small">Pick a sample or paste your own, then press Scan.</Text>
        )}
        {/* Always on the page (the site's one canvas starts only where a 3D area exists at load). */}
        <div className="relative mt-8 overflow-hidden rounded-sm border border-line">
          <LazyView
            className="h-stage-sm"
            label={
              result
                ? `Readiness ${result.score} of 100 (${result.grade}): ${result.summary.critical} critical, ${result.summary.high} high, ${result.summary.medium} medium and ${result.summary.low} low findings.`
                : "Readiness bars appear here after a scan."
            }
          >
            {(onScreen) => (
              <ScannerBars
                at={resultAt}
                result={
                  result && {
                    score: result.score,
                    grade: result.grade,
                    summary: result.summary,
                    hybridPq: probe?.hybridPq,
                  }
                }
                active={onScreen}
                reduce={reduce}
              />
            )}
          </LazyView>
          <StagePurpose>
            how ready this system is for quantum-safe cryptography, in totals.
          </StagePurpose>
        </div>
      </aside>

      {result && (
        <div className="overflow-x-auto lg:col-span-2">
          <table className="w-full min-w-panel text-left">
            <caption className="sr-only">Scanner findings</caption>
            <thead>
              <tr className="border-b border-line">
                {["Line", "Finding", "Severity", "Why it matters", "Replace with"].map((h) => (
                  <Label key={h} as="th" className="py-3 pr-6 font-normal">
                    {h}
                  </Label>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.findings.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-small text-fg-3">
                    No quantum-vulnerable cryptography detected.
                  </td>
                </tr>
              )}
              {result.findings.map((f, i) => (
                <tr key={`${f.line}-${f.ruleId}-${i}`} className="border-b border-line align-top">
                  <td className="tabular py-4 pr-6 font-mono text-small text-fg-3">{f.line}</td>
                  <td className="py-4 pr-6">
                    <p className="text-small text-fg">{f.algorithm}</p>
                    <p
                      className="max-w-text truncate font-mono text-small text-fg-3"
                      title={f.match}
                    >
                      {f.match}
                      {f.parameter && ` · ${f.parameter}`}
                    </p>
                  </td>
                  <td className="whitespace-nowrap py-4 pr-6 text-small text-fg-2">
                    <span className={`mr-2 ${SEVERITY_DOT[f.severity]}`} aria-hidden>
                      ●
                    </span>
                    {f.severity}
                  </td>
                  <td className="py-4 pr-6 text-small text-fg-2">{f.why}</td>
                  <td className="py-4 text-small text-fg-2">{f.replacement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {plan && (
        <section
          aria-labelledby="plan-title"
          className="space-y-6 border-t border-line pt-12 lg:col-span-2"
        >
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <Label as="p">Migration plan</Label>
              <Heading as="h2" variant="h2" className="mt-2">
                <span id="plan-title">{plan.steps.length} steps, most urgent first</span>
              </Heading>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="lifetime" className="font-mono text-label uppercase text-fg-3">
                Data must stay secret for
              </label>
              <select
                id="lifetime"
                value={lifetime}
                onChange={(e) => setLifetime(Number(e.target.value))}
                className="h-10 rounded-sm border border-line bg-inset px-3 text-small text-fg outline-none focus:border-line-strong"
              >
                {LIFETIMES.map((y) => (
                  <option key={y} value={y}>
                    {y} {y === 1 ? "year" : "years"}
                  </option>
                ))}
              </select>
              <Button onClick={downloadPlan}>Export Markdown</Button>
            </div>
          </div>
          <Text size="small" className="max-w-text">
            Priority uses Mosca’s inequality: if data lifetime plus migration time exceeds the years
            left until {plan.assumptions.horizonYear} (a planning horizon, not a prediction), that
            step is already late.
          </Text>
          <ol className="border-b border-line">
            {plan.steps.map((st) => {
              const checked = done.has(st.id);
              return (
                <li
                  key={st.id}
                  className="grid grid-cols-12 gap-x-6 gap-y-2 border-t border-line py-6"
                >
                  <label className="col-span-12 flex items-start gap-3 md:col-span-5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setDone((d) => {
                          const n = new Set(d);
                          if (n.has(st.id)) n.delete(st.id);
                          else n.add(st.id);
                          return n;
                        })
                      }
                      className="mt-1 accent-fg"
                    />
                    <span>
                      <span
                        className={`block text-body ${checked ? "text-fg-3 line-through" : "text-fg"}`}
                      >
                        {st.title}
                      </span>
                      <span className="mt-1 block font-mono text-label uppercase text-fg-3">
                        <span className={st.priority === "P1" ? "text-warn" : ""}>
                          {st.priority}
                        </span>{" "}
                        · {st.fixer} · effort {st.effort}
                      </span>
                    </span>
                  </label>
                  <p className="col-span-12 text-small text-fg-2 md:col-span-4">{st.why}</p>
                  <p className="col-span-12 text-small text-fg-2 md:col-span-3">{st.action}</p>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
