/**
 * Warms the live runtime (keys, ledger, simulation) as the server boots, instead of on the first
 * visitor's request. Loading a large key store is synchronous work; done here, it happens while the
 * server is still idle, so the first page someone opens never waits behind it.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.QSETU_NO_WARM === "1") return;
  const port = process.env.PORT ?? "3000";
  setTimeout(() => {
    const t0 = Date.now();
    void fetch(`http://127.0.0.1:${port}/api/ledger?limit=5`, {
      signal: AbortSignal.timeout(180_000),
    })
      .then((r) => console.log(`[warm] live runtime ready (${r.status}) in ${Date.now() - t0} ms`))
      .catch(() => console.log("[warm] runtime warm-up skipped; it starts on the first request"));
  }, 500);
}
