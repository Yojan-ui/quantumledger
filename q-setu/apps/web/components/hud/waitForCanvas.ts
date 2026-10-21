/**
 * Resolves once the shared WebGL canvas is in the page (or after `ms`). In its own file so the
 * homepage can wait for it without pulling in the diagnostics HUD (./DiagnosticsApp).
 */
export function waitForCanvas(ms = 5000): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const check = () => {
      if (document.querySelector("canvas:not([aria-hidden])") || performance.now() - t0 > ms)
        resolve();
      else setTimeout(check, 100);
    };
    check();
  });
}
