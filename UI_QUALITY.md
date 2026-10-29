# QuantumLedger Lab: UI quality contract

Re-read at the start of every stage. Scope and decisions: `docs/ui_brief.md`.

## Honesty
- Never invent backend functions, endpoints, fields or results. Read the code first; if the UI needs something
  missing, add it to the backend with a test, or stop and ask.
- No mocked data in the shipped UI. Sample data only through the real backend path, labelled "Sample data".
- Every number on screen comes from a backend response or run log (timestamp + input SHA-256).
- Ask before adding a framework, bundler, paid/remote service, or changing existing backend behaviour
  (adding endpoints is fine). Commit at the end of each stage; never say "done" without the evidence below.

## Look: black and white, editorial, light
- `tokens.css` holds every colour, size, space, radius, duration and z-index; nothing hard-coded elsewhere.
- Palette: base #000000 / #050505; surfaces #0A0A0A, #111111; hairlines rgba(255,255,255,.08) and .16;
  text #F5F5F5 / #A3A3A3 / #737373. Emphasis = pure white, inverted blocks, size, weight. Not colour.
  (One desaturated semantic token only if approved, only on that data.)
- Optional `[data-theme=light]`: exact inverse, same contrast. Default dark.
- Type: Inter Tight 600/700 display; JetBrains Mono for numbers, IDs, labels; tabular numerals. Vendored
  woff2 with OFL licences; metric-matched fallbacks (size-adjust, ascent-override): zero layout shift.
- 12-column grid, 1px hairlines, asymmetric editorial layouts, generous negative space, hero numbers
  clamp(96px,10vw,160px) at -0.035em, 11px uppercase eyebrows at 0.12em, 2px chips, 8px surfaces.
- Banned: gradient blobs, glassmorphism, emoji, sparkle icons, "Unlock the power of…", centred hero + 3
  cards, stock illustrations, pill buttons everywhere, shadows on every box, lorem ipsum, "coming soon",
  grids of identical cards.
- Real domain terms (ML-KEM-768, ML-DSA-65, X25519MLKEM768, CBOM, Proof Chain, harvest-now-decrypt-later).
- Every screen: designed loading / empty / error / success states. Contrast ≥ 4.5:1 (≥ 3:1 large), node-tested.

## 3D world and motion
- Plain ES modules + vendored, version-pinned three served from the lab's `/vendor`. No React, no bundler, no CDN.
- ONE persistent world: one renderer, one scene, one fixed canvas. Routes = camera pose + mounted layer
  `{group, update(dt), dispose()}`. The canvas draws only inside the route's `[data-stage]` rect (scissor).
- Flights 1.1–1.6 s by distance, ease-in-out-cubic with ~3.5 % overshoot then settle. Overlays after arrival:
  280 ms cubic-bezier(.2,.8,.2,1), 40–60 ms stagger, 24 px rise; exits 180 ms. Parallax ≤ 2°, breathing ≤ 1.5 %.
  Click flies to the item; Esc flies back.
- Monochrome rendering: white/grey on black, exponential fog, ACES tone mapping, post pass with ~3 % grain and
  soft vignette, no bloom on text (text is DOM). Rim light, wireframe→solid morphs, light sweeps driven by real
  run events. The landing intro resolves into real data.
- Every motion maps to a data field (brief §d). Live run choreography is driven only by real SSE events.
- motion.js = pure functions mirrored as CSS custom properties; a node test checks they match.

## Performance (measure, don't claim)
- Instanced meshes / Points with instanced attributes; animation in GLSL via uniforms; no per-frame JS loops
  over objects; ≤ 60 draw calls; DPR ≤ 2 (1.5 mobile); adaptive quality; rAF paused when hidden; heavy prep in
  a Web Worker with transferable arrays; server scene.json per result with an ETag.
- Input→visual next frame (≤ 16 ms); flight starts next frame; API reads < 50 ms p95 on localhost; landing
  FCP < 1 s, interactive < 1.5 s; own JS+CSS+shaders ≤ 250 KB (three excluded); 60 fps on a laptop iGPU,
  report the worst frame.
- Fallbacks: no WebGL, lost context, `?no3d`, reduced motion → full 2D version of every screen (SVG/canvas,
  crossfades). Every feature works without 3D.

## Data in, correct output out
- Forms with inline validation mirroring the server; `error.fields` render next to the field. Drag-and-drop
  upload with type/size limits, parse preview, downloadable sample-format file, paste-in.
- Run: POST → run_id → SSE (stage, %, log) → result. Cancel works. One active run per workspace; a second gets 409.
- Results read only from the result JSON; every figure links to its source (file:line, run log). Export JSON,
  CSV, CBOM, plan, printable report. Show timestamp, input SHA-256, duration, version.
- api.js: one fetch wrapper (timeout, one retry for idempotent GETs, abort, typed ApiError, each failure surfaced
  once: toast + inline). Client cache per workspace; SSE patches it; no refetch on route change.
- Server: 127.0.0.1 by default, JSON everywhere, SPA fallback, CSRF header on writes if auth exists, upload cap,
  path-traversal safe, subprocesses with timeouts and clean shutdown.

## Interaction
Command palette (Ctrl/Cmd+K); full keyboard navigation; visible 2px focus rings; skip link; aria-live run
announcements; rolling numbers (600 ms ease-out); raycast tooltips with real fields; click → detail + camera
focus + URL (survives refresh); optional UI sound, off by default, persisted. Layouts at 1440×900, 1280×720, 390×844.

## Zero errors: proof per stage
- route_check (Playwright): every route × 3 viewports × (3D on, `?no3d`) → zero console errors/warnings, failed
  requests, unhandled rejections, 5xx; plus one real input→run→result flow, invalid input, oversized upload,
  cancelled run.
- Backend tests green incl. new endpoint tests and an end-to-end test on real sample data; `node --check` on all
  JS; node unit tests for router, motion, data transforms, contrast.
- Screenshots of every route at 3 sizes in `screenshots/<stage>/`; `review.md` as a harsh senior-designer
  critique; fix the 3 weakest screens; re-shoot; before/after.
- Report per stage: test counts, route_check result, API p95, FCP, fps + worst frame, asset size, commit hash.
