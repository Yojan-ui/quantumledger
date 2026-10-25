# Smooth pass: review

Branch `smooth-pass`. Part 1 measured every page (`audit-before.md`), Part 2 fixed what it found
(`audit-after.md`), and Part 3 made the site's existing scenes respond to the visitor. Every number below
comes from `pnpm audit:glitch` against the production build, on an Apple M4 (Metal) in system Chrome. The
390 px runs use 4× CPU throttling.

Videos: `before/` and `after/` each hold the homepage (1440 and 390) and the five demos (1440). Each is a
10 s Playwright recording of: load, scroll to the end, then the page's main action. The full sets for
every page are written to `videos-before/` and `videos-after/`. They are not committed.

## Before → after

|                                                  | Before (1440 / 390)          | After (1440 / 390)      |
| ------------------------------------------------ | ---------------------------- | ----------------------- |
| Worst page CLS                                   | 0.726 / 1.209                | 0.013 / 0.036           |
| Homepage CLS                                     | 0.726 / 1.209                | 0 / 0.0001              |
| Worst frame while scrolling                      | 50 / 300 ms                  | 17* / 50 ms             |
| Worst frame in a transition                      | 33 / 100 ms                  | 17* / 33 ms             |
| Long tasks over 50 ms (all pages)                | 0 / 127                      | 1 per page* / 71        |
| `/demos` frame p95 in a transition               | 33.4 ms (30 fps)             | 16.8 ms                 |
| Console errors, hydration warnings, context loss | 1 (the deliberate 404), 0, 0 | the same 404 only, 0, 0 |
| Worst interaction (INP)                          | not measured                 | 32 / 64 ms              |

\* 1440 figures from the re-run of the pages a second browser disturbed. See `audit-after.md`.

## Each glitch and its fix

| #   | Glitch (from `audit-before.md`)                                                                                   | Fix                                                                                                                                                                                                                                                                                                                                      | Where                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | The page jumped while scrolling: homepage CLS 1.21 at 390 and 0.73 at 1440, `/demo/deploy` 0.45, `/platform` 0.24 | The cause was the glow behind the globe. It followed the globe by rewriting `left`, `top` and `width` every frame. It now moves only with `transform: translate3d() scale()`, at a fixed 900 px size, inside a clipped fixed layer.                                                                                                      | `components/world/WorldCanvas.tsx` (`GlobeGlow`), `app/globals.css` (`.ambient`)  |
| 2   | The first scroll on a phone froze for 100–125 ms on every page, including static docs                             | The 3D world now boots only on pages that have a 3D area (`[data-world-focus]`, `[data-3d]`, `[data-hud-stage]`). It boots in idle time once that area is within a screen of the viewport, and never because of the visitor's first scroll. A client navigation to a 3D page checks again. `Warmup` no longer parses three.js on phones. | `WorldCanvas.tsx`, `components/ui/Warmup.tsx`                                     |
| 3   | The pinned "How it works" re-rendered on every scroll frame                                                       | It is now a ScrollTrigger on the shared clock. Its React state is quantised to 1/50 of a step, so React skips identical values.                                                                                                                                                                                                          | `components/home/Story.tsx`                                                       |
| 4   | `/demos` ran at 30 fps (four preview videos decoding at once)                                                     | Each preview plays only while 25% of it is on screen. Under reduced motion they don't autoplay.                                                                                                                                                                                                                                          | `components/demos/DemoPanels.tsx`                                                 |
| 5   | The HUD's top bar shifted after load (CLS 0.11)                                                                   | The clock renders a same-width `--:--:--` until it is mounted. The threat pill stacks all three labels in one grid cell, so it is always as wide as the longest.                                                                                                                                                                         | `components/hud/TopBar.tsx`                                                       |
| 6   | The scanner's input jumped when a live TLS result landed                                                          | From the click, the result line's slot holds a "Probing…" line of the same shape.                                                                                                                                                                                                                                                        | `components/demo/Scanner.tsx`                                                     |
| 7   | Translucent 3D layers could flicker where they overlapped                                                         | All 22 transparent materials that still wrote depth now have `depthWrite={false}`. The globe's layers have an explicit `renderOrder`: graticule, ocean, land, rim. The camera's near/far is 0.05/50.                                                                                                                                     | `components/**`                                                                   |
| 8   | Frame hitches from garbage collection                                                                             | `useFrame` no longer allocates: a `set3` helper replaces `.set([x,y,z])`, vectors are reused, and the arcs' packet list is compacted in place.                                                                                                                                                                                           | `components/scenes/geometry.ts` and about ten scenes                              |
| 9   | Heavy repaints under the sticky nav and the HUD panels                                                            | `backdrop-filter` is gone. The nav is 94% opaque and the HUD glass is a dark tint. `lint:design` now bans blur everywhere.                                                                                                                                                                                                               | `styles/tokens.css`, `Nav.tsx`, `HudPanel.tsx`, `scripts/lint-design.mjs`         |
| 10  | No recovery from a lost WebGL context, and blank boxes while 3D loaded                                            | `webglcontextlost` is prevented and sets `html[data-gl-lost]`. Every 3D area then shows its poster with "Restoring 3D…". On `webglcontextrestored` the canvas is rebuilt from scratch. The same poster holds the frame before a scene's first frame, then crossfades out in 300 ms.                                                      | `WorldScene.tsx`, `WorldCanvas.tsx`, `scenes/LazyView.tsx`, `world/SceneView.tsx` |

Done at the same time, from the brief's checklist:

- **One canvas, drawn on demand.** `frameloop="demand"`. A driver on GSAP's ticker calls `invalidate()`
  only while a 3D area is on screen. The list of areas is cached and re-queried only when the DOM changes.
  Each drei `View` precompiles its shaders with `gl.compile` on mount, and `<Preload all />` runs once.
- **Quality ladder.** `PerformanceMonitor` steps a shared quality level up and down. Each step down, in
  order: DPR 1.75 → 1.25, then half the swarm particles and no ocean dots, then no focus dimming and no
  glow halos or rim, with DPR 1. There is no Bloom or DOF pass to drop: the stage fakes glow with
  additive halos (see `docs/motion/review-2.md`).
- **One clock for scrolling.** Lenis is stepped by `gsap.ticker`, which also drives ScrollTrigger and the
  3D frame driver. Any native `scrollTo` or `scrollIntoView` first stops Lenis's glide. This matters for
  Next's scroll reset on navigation, focus and anchors: the audit caught Lenis overriding a `scrollTo(0)`.
  Lenis is off under reduced motion.
- **GSAP hygiene.** Every timeline is created inside `gsap.context()` and reverted on unmount. The camera
  and the deploy pose tween from their current values, so a new shot that starts mid-move blends instead
  of jumping. Progress bars animate `transform` only.
- **Server and streams.** `GET /api/health`. A status note says "Waking up the server…" after 2 s
  without an answer, and "Can't reach the server" with Retry if the check fails. It re-checks every
  4 minutes while the tab is visible, which also keeps a sleeping host warm. Each SSE stream reconnects
  with backoff (0.5 s doubling to 8 s, with jitter) and shows "Reconnecting to live data…".
- **Buttons.** A second click within 350 ms is ignored. A button whose `onClick` returns a promise is
  `aria-busy`: it is dimmed, has a progress bar along its edge and ignores clicks until the promise
  settles. It then flashes done (green) or error (red), and an error toast gives a short message with
  Retry.
- **Kept as they were.** Fonts were already `next/font` (Geist, `display: swap`, with adjusted fallback
  metrics). There were no hydration warnings before or after. Crypto already ran in workers (handshake,
  Q-Day, room, web, edge, world).

## New interactions, and what each teaches

| Interaction                                                                 | What it does (all real)                                                                                                                                                                                                       | What it teaches                                                                                               |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Click a packet in flight** on the globe                                   | Pins a label with that packet's bus event: event #, operation, algorithm, bytes, measured latency and route. Simulated traffic is marked "(sim)".                                                                             | Every dot on the globe is a real operation with a cost, not decoration.                                       |
| **Click a city**                                                            | Runs a real seal from that city (as before). Its label now stays pinned and its live counts update as the packet lands.                                                                                                       | Cause and effect: your click becomes a sealed packet and a ledger entry.                                      |
| **Click a Proof Chain block**                                               | Opens that entry as stored: kind, subject, time, payload, `prev`, `hash`, the ML-DSA-65 signature (3,309 B) and its key.                                                                                                      | The chain is just data: each block names its predecessor's hash and is signed. Tampering has nowhere to hide. |
| **Click a diagnostics object** (sphere, server, client, vault, link, block) | Pins its anchored label with the pipeline's real values. Click again to unpin.                                                                                                                                                | You can read the stage at your own pace, not only on autoplay.                                                |
| **Drag and fling the globe and the diagnostics stage**                      | Inertia on release. After 3 s without a touch it springs back to the shot's framing. Double-click re-frames at once.                                                                                                          | You can explore, and the director always brings the story back.                                               |
| **"Try it" on every demo**                                                  | One primary button in the same place on all four demos. It runs that demo's real sequence: the handshake and then the attack, deploy, Q-Day, or tamper/restore and then verify. It is busy within one frame (52 ms measured). | One consistent way in, for a visitor who doesn't read the controls.                                           |
| **Mosca sliders**                                                           | X and Y move the 3D stage, the gauge and the labels live, coalesced to one update per frame. The thumb itself never lags.                                                                                                     | Shelf life plus migration time versus Q-Day is a comparison you can feel.                                     |
| **Scroll-scrubbed "How it works"**                                          | ScrollTrigger maps scroll to the three steps. The step bar is clickable and glides with Lenis.                                                                                                                                | The order of the story: harvest, then Q-Day, then sealed.                                                     |
| **Keys**                                                                    | ← → step, Space play/pause and R reset, on every demo and the HUD. **?** opens a shortcuts list. Esc closes labels, the list and the menu.                                                                                    | The site can be presented from the keyboard.                                                                  |
| **Buttons and cards**                                                       | Primary buttons pull up to 6 px toward the cursor, others 4 px. Every button presses to 0.97 and has busy, done and error states. Cards tilt up to 6° with a cursor-following sheen and spotlight.                            | Every control answers within a frame.                                                                         |

All of it respects `prefers-reduced-motion`. There is no fling, orbit, magnetic pull, tilt or Lenis.
Busy bars are static, and scenes cut instead of moving.

## Gates

- `pnpm lint:design`: ✓ apps/web uses only design tokens. Blur is now banned outright.
- `pnpm test`: 19 files, 128 tests passed.
- `pnpm build`: done. ESLint and `tsc --noEmit` are clean.

## Still open

- **Phones still have a ~200 ms 3D boot task** shortly after load, in idle time, on pages with 3D. It
  no longer overlaps scrolling or transitions. Splitting it would mean lazy shader compiles, which bring
  back first-frame hitches.
- **One 50 ms scroll frame on the homepage at 390 with 4× CPU.** p95 is 16.8 ms.
- **Hosting.** This repo serves the site and API from one Next.js server, so there is no separate Render
  API to keep warm. `/api/health`, the "Waking up the server…" note and the 4-minute keep-warm work the
  same either way. Pointing them at a separate API origin is one URL.
- **Not measured: real context loss.** The handlers are in place, but the audit runs never lost a
  context. It was not forced with `WEBGL_lose_context`.
