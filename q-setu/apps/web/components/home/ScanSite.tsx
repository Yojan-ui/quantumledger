"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Grid, Label, Section, Text } from "@/components/ui";
import { Copy, CopyHeading } from "@/components/ui/Copy";
import { ScanResult, ScanSkeleton } from "@/components/scan/ScanResult";
import { world } from "@/components/world/store";
import { burst } from "@/lib/client/burst";
import { track } from "@/lib/client/analytics";
import { errText } from "@/lib/client/api";
import { SUGGESTED_HOSTS, type ScanView } from "@/lib/scan-types";
import { useJourney } from "@/lib/client/journey";

/**
 * "Is your bank quantum-safe?" The signature interaction: a real TLS probe of any public site. The
 * globe turns to the server's region and an arc lights saffron (harvestable) or cyan (hybrid PQ).
 */
export function ScanSite() {
  const ref = useRef<HTMLDivElement>(null);
  useJourney(ref, 4, 5);
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<ScanView>();
  // The glow behind the globe says the verdict: KEM if hybrid post-quantum, WARN if harvestable.
  const resultRole = useRef<"kem" | "warn" | null>(null);

  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => {
        world.scanActive = !!e?.isIntersecting;
        if (e?.isIntersecting) world.glow = resultRole.current;
      },
      { threshold: 0.35 },
    );
    if (ref.current) io.observe(ref.current);
    if (location.hash === "#scan") input.current?.focus({ preventScroll: true });
    return () => {
      io.disconnect();
      world.scanActive = false;
    };
  }, []);

  async function run(target = url) {
    if (!target.trim()) return input.current?.focus();
    setUrl(target);
    setBusy(true);
    setError(undefined);
    track("scan_run", { source: "home" });
    try {
      const res = await fetch("/api/scan/url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const data = (await res.json()) as ScanView;
      if (!res.ok) throw new Error(errText(data, `Scan failed (${res.status})`));
      setResult(data);
      // Done: a short burst from the scan box (once, < 600 ms).
      if (input.current) burst(input.current);
      world.scan = {
        lat: data.geo.lat,
        lon: data.geo.lon,
        ok: data.probe.hybridPq,
        at: performance.now(),
      };
      resultRole.current = data.probe.hybridPq ? "kem" : "warn";
      world.glow = resultRole.current;
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "Couldn't reach the scanner. Check your connection and try again."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section id="scan" label="Scan any site" role="warn">
      <div ref={ref}>
        <Grid className="gap-y-12">
          <div className="col-span-12 lg:col-span-7 lg:col-start-6">
            <CopyHeading
              simple={"Is your bank quantum\u2011safe?"}
              technical="Scan any site's TLS, live."
              className="max-w-text"
            />
            <Text className="mt-4 max-w-text">
              <Copy
                simple="Enter any website. We connect to it now and check which lock it uses."
                technical="Enter any host. We open one TLS handshake, offering X25519MLKEM768 first, and read the negotiated group, version and certificate key."
              />
            </Text>
            <form
              className="mt-8 flex flex-col gap-3 md:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                void run();
              }}
            >
              <label htmlFor="scan-site" className="sr-only">
                Enter any website
              </label>
              <input
                ref={input}
                id="scan-site"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter any website"
                autoComplete="off"
                inputMode="url"
                className="h-14 w-full min-w-0 rounded-sm border border-line-strong bg-inset px-4 text-h3 md:flex-1 text-fg outline-none transition-colors duration-150 placeholder:text-fg-3 focus:border-fg-3"
              />
              <Button variant="primary" type="submit" disabled={busy} className="h-14 px-6">
                {busy ? "Scanning…" : "Scan"}
              </Button>
            </form>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Label as="span">Try</Label>
              {SUGGESTED_HOSTS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => void run(h)}
                  disabled={busy}
                  className="font-mono text-small text-fg-2 underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-fg disabled:opacity-40"
                >
                  {h.replace(/^www\./, "")}
                </button>
              ))}
            </div>
            <div className="mt-12 min-h-panel">
              {busy && <ScanSkeleton />}
              {!busy && error && (
                <div className="space-y-3 border-t border-line pt-6" role="alert">
                  <p className="text-body text-fg">That scan didn’t work.</p>
                  <Text size="small">{error}</Text>
                  <Button onClick={() => run()}>Try again</Button>
                </div>
              )}
              {!busy && !error && result && <ScanResult r={result} />}
              {!busy && !error && !result && (
                // Before a scan, the result's frame with empty readings: what a scan will fill in.
                <div className="border-t border-line pt-6">
                  <dl className="grid grid-cols-3 border-b border-line pb-6">
                    {[
                      ["Readiness", "– / 100"],
                      ["Key exchange", "–"],
                      ["Certificate key", "–"],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        className="border-l border-line pl-4 first:border-l-0 first:pl-0"
                      >
                        <dt className="font-mono text-label uppercase text-fg-3">{k}</dt>
                        <dd className="mt-2 font-mono text-h3 text-fg-3">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <Text size="small" className="mt-6 text-fg-3">
                    Results show a 0–100 readiness score, what was negotiated, and three findings in
                    plain language. Nothing about you is stored; scanned results are kept by host so
                    they can be shared.
                  </Text>
                </div>
              )}
            </div>
          </div>
          {/* The globe on the left this time: a close, low shot over the scanned server's city. */}
          <div className="col-span-12 hidden lg:col-span-5 lg:col-start-1 lg:row-start-1 lg:block">
            <div data-world-focus data-world-drag className="sticky top-14 h-story" aria-hidden />
          </div>
        </Grid>
      </div>
    </Section>
  );
}
