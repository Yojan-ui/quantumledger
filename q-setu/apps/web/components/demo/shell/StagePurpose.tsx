/**
 * One small line at the top of a demo's stage saying what the scene shows, in the HUD's mono label
 * style. The 3D labels keep clear of it ([data-label-avoid]).
 */
export function StagePurpose({ children }: { children: string }) {
  return (
    <p
      data-label-avoid
      style={{ maxWidth: "min(34rem, calc(100% - 2rem))" }}
      className="pointer-events-none absolute left-4 top-4 z-10 font-mono text-label uppercase text-fg-3 md:left-6 md:top-6"
    >
      <span className="text-fg-2">What this shows:</span> {children}
    </p>
  );
}
