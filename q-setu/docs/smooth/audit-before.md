# Glitch audit (before)

`pnpm audit:glitch before` against the production build at http://localhost:3000, 2026-10-12T17:15 UTC.
Every page at 1440×900, and at 390×844 with 4× CPU throttling. Each run: load, scroll to the end, the
page's main action (Play, Verify, Tamper, Scan… or hover across it), 10 s in all. Videos are in
`docs/smooth/videos-before/` (not committed).

## Totals

|                                  | 1440   | 390 (4× CPU) |
| -------------------------------- | ------ | ------------ |
| Console errors + page errors     | 1      | 1            |
| Console warnings                 | 0      | 0            |
| Hydration warnings               | 0      | 0            |
| WebGL driver messages            | 0      | 0            |
| WebGL contexts lost              | 0      | 0            |
| Long tasks > 50 ms               | 0      | 127          |
| Worst frame while scrolling (ms) | 50     | 300          |
| Worst frame in a transition (ms) | 33     | 100          |
| Worst page CLS                   | 0.7263 | 1.209        |
| Failed requests                  | 1      | 1            |

## Ranked (worst first)

| #   | Page                          | Width | Score | Errors | Hydration | Lost | Long tasks  | Scroll worst / p95 (ms) | Transition worst / p95 (ms) | CLS    | Failed |
| --- | ----------------------------- | ----- | ----- | ------ | --------- | ---- | ----------- | ----------------------- | --------------------------- | ------ | ------ |
| 1   | `/`                           | 390   | 243   | 0      | 0         | 0    | 5 (max 125) | 83 / 16.8               | 33 / 16.8                   | 1.209  | 0      |
| 2   | `/`                           | 1440  | 135   | 0      | 0         | 0    | 0           | 50 / 16.8               | 17 / 16.8                   | 0.7263 | 0      |
| 3   | `/demo/deploy`                | 390   | 94    | 0      | 0         | 0    | 3 (max 96)  | 100 / 16.7              | 17 / 16.7                   | 0.4548 | 0      |
| 4   | `/demos`                      | 390   | 53    | 0      | 0         | 0    | 3 (max 98)  | 300 / 16.8              | 34 / 33.4                   | 0      | 0      |
| 5   | `/platform`                   | 1440  | 38    | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0.2417 | 0      |
| 6   | `/this-page-does-not-exist`   | 390   | 35    | 1      | 0         | 0    | 3 (max 94)  | 83 / 16.8               | 17 / 16.7                   | 0      | 1      |
| 7   | `/solutions/healthcare`       | 390   | 25    | 0      | 0         | 0    | 4 (max 96)  | 150 / 16.8              | 17 / 16.7                   | 0.0554 | 0      |
| 8   | `/this-page-does-not-exist`   | 1440  | 25    | 1      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 1      |
| 9   | `/solutions`                  | 390   | 24    | 0      | 0         | 0    | 4 (max 95)  | 150 / 16.8              | 17 / 16.7                   | 0.0494 | 0      |
| 10  | `/solutions/fintech`          | 390   | 24    | 0      | 0         | 0    | 4 (max 94)  | 150 / 16.7              | 17 / 16.8                   | 0.0291 | 0      |
| 11  | `/solutions/education`        | 390   | 24    | 0      | 0         | 0    | 4 (max 98)  | 150 / 16.8              | 17 / 16.7                   | 0.0271 | 0      |
| 12  | `/solutions/government`       | 390   | 24    | 0      | 0         | 0    | 4 (max 96)  | 150 / 16.7              | 17 / 16.7                   | 0.0286 | 0      |
| 13  | `/about`                      | 390   | 24    | 0      | 0         | 0    | 4 (max 100) | 150 / 16.8              | 17 / 16.7                   | 0.04   | 0      |
| 14  | `/demo/scanner`               | 390   | 22    | 0      | 0         | 0    | 3 (max 95)  | 100 / 16.7              | 33 / 16.7                   | 0.0968 | 0      |
| 15  | `/platform`                   | 390   | 21    | 0      | 0         | 0    | 4 (max 106) | 83 / 16.7               | 100 / 16.7                  | 0      | 0      |
| 16  | `/index`                      | 390   | 21    | 0      | 0         | 0    | 4 (max 98)  | 133 / 16.8              | 33 / 16.8                   | 0.0235 | 0      |
| 17  | `/index`                      | 1440  | 20    | 0      | 0         | 0    | 0           | 33 / 16.7               | 17 / 16.7                   | 0.1515 | 0      |
| 18  | `/demo/how-it-works`          | 390   | 16    | 0      | 0         | 0    | 3 (max 103) | 117 / 16.8              | 17 / 16.8                   | 0      | 0      |
| 19  | `/demo/qday`                  | 390   | 16    | 0      | 0         | 0    | 3 (max 105) | 117 / 16.7              | 33 / 16.8                   | 0.0097 | 0      |
| 20  | `/demo/ledger`                | 390   | 16    | 0      | 0         | 0    | 3 (max 107) | 117 / 16.8              | 33 / 16.7                   | 0      | 0      |
| 21  | `/contact`                    | 390   | 13    | 0      | 0         | 0    | 3 (max 96)  | 100 / 16.8              | 17 / 16.8                   | 0      | 0      |
| 22  | `/privacy`                    | 390   | 13    | 0      | 0         | 0    | 3 (max 96)  | 100 / 16.8              | 17 / 16.8                   | 0      | 0      |
| 23  | `/terms`                      | 390   | 13    | 0      | 0         | 0    | 3 (max 105) | 100 / 16.8              | 17 / 16.7                   | 0      | 0      |
| 24  | `/diagnostics`                | 1440  | 12    | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0.1118 | 0      |
| 25  | `/pricing`                    | 390   | 10    | 0      | 0         | 0    | 3 (max 95)  | 83 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 26  | `/security`                   | 390   | 10    | 0      | 0         | 0    | 3 (max 98)  | 83 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 27  | `/changelog`                  | 390   | 10    | 0      | 0         | 0    | 3 (max 96)  | 83 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 28  | `/docs/api`                   | 390   | 10    | 0      | 0         | 0    | 3 (max 98)  | 83 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 29  | `/docs`                       | 390   | 10    | 0      | 0         | 0    | 3 (max 98)  | 83 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 30  | `/docs/security-model`        | 390   | 10    | 0      | 0         | 0    | 3 (max 97)  | 83 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 31  | `/docs/adapters/edge`         | 390   | 10    | 0      | 0         | 0    | 3 (max 98)  | 83 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 32  | `/docs/adapters/sdk`          | 390   | 10    | 0      | 0         | 0    | 3 (max 95)  | 83 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 33  | `/docs/adapters/shield`       | 390   | 10    | 0      | 0         | 0    | 3 (max 97)  | 83 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 34  | `/docs/adapters/vault`        | 390   | 10    | 0      | 0         | 0    | 3 (max 96)  | 83 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 35  | `/docs/adapters/web`          | 390   | 10    | 0      | 0         | 0    | 3 (max 97)  | 83 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 36  | `/docs/concepts/hybrid-kem`   | 390   | 10    | 0      | 0         | 0    | 3 (max 97)  | 83 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 37  | `/docs/concepts`              | 390   | 10    | 0      | 0         | 0    | 3 (max 96)  | 83 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 38  | `/docs/concepts/key-rotation` | 390   | 10    | 0      | 0         | 0    | 3 (max 103) | 83 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 39  | `/docs/concepts/sessions`     | 390   | 10    | 0      | 0         | 0    | 3 (max 96)  | 83 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 40  | `/docs/concepts/signatures`   | 390   | 10    | 0      | 0         | 0    | 3 (max 95)  | 83 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 41  | `/pitch`                      | 390   | 10    | 0      | 0         | 0    | 3 (max 98)  | 83 / 16.8               | 17 / 16.7                   | 0.005  | 0      |
| 42  | `/scan/www.irctc.co.in`       | 390   | 10    | 0      | 0         | 0    | 3 (max 96)  | 83 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 43  | `/demo/deploy`                | 1440  | 5     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0.0772 | 0      |
| 44  | `/diagnostics`                | 390   | 4     | 0      | 0         | 0    | 4 (max 117) | 17 / 16.8               | 17 / 16.8                   | 0.0467 | 0      |
| 45  | `/join`                       | 390   | 2     | 0      | 0         | 0    | 2 (max 85)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 46  | `/solutions/education`        | 1440  | 0     | 0      | 0         | 0    | 0           | 33 / 16.8               | 17 / 16.8                   | 0.0506 | 0      |
| 47  | `/solutions`                  | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0.0494 | 0      |
| 48  | `/solutions/fintech`          | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0.0461 | 0      |
| 49  | `/solutions/healthcare`       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0.0461 | 0      |
| 50  | `/solutions/government`       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0.0461 | 0      |
| 51  | `/demos`                      | 1440  | 0     | 0      | 0         | 0    | 0           | 33 / 16.7               | 33 / 33.4                   | 0      | 0      |
| 52  | `/demo/how-it-works`          | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0.0013 | 0      |
| 53  | `/demo/qday`                  | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0.002  | 0      |
| 54  | `/demo/ledger`                | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0.0016 | 0      |
| 55  | `/demo/scanner`               | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0.0249 | 0      |
| 56  | `/pricing`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 57  | `/security`                   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 58  | `/about`                      | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0.0465 | 0      |
| 59  | `/changelog`                  | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 60  | `/contact`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 61  | `/privacy`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 62  | `/terms`                      | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 63  | `/docs/api`                   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 64  | `/docs`                       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 65  | `/docs/security-model`        | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 66  | `/docs/adapters/edge`         | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 67  | `/docs/adapters/sdk`          | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 68  | `/docs/adapters/shield`       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 69  | `/docs/adapters/vault`        | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 70  | `/docs/adapters/web`          | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 71  | `/docs/concepts/hybrid-kem`   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 72  | `/docs/concepts`              | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 73  | `/docs/concepts/key-rotation` | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 74  | `/docs/concepts/sessions`     | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 75  | `/docs/concepts/signatures`   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 76  | `/join`                       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0.0131 | 0      |
| 77  | `/pitch`                      | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 78  | `/scan/www.irctc.co.in`       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |

## What glitches, and why (ranked)

Ranked by how much a visitor would notice. Causes were found from the audit's shift sources, a CPU
profile of `/docs` at 390 with 4× throttling (long tasks at 136 ms, 415 ms and 5,188 ms after
navigation), and reading the code behind each element.

| #   | Glitch                                                                                             | Where                                                                                                            | How bad                                                                                     | Cause                                                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The page jumps while scrolling: CLS 1.21 at 390, 0.73 at 1440                                      | `/`, also `/demo/deploy` (0.45 at 390), `/platform` (0.24), `/index` (0.15), `/solutions/*` and `/about` (~0.05) | Severe: CLS is 15–25× the 0.05 target on the homepage. Every scroll frame counts as a shift | `div.ambient`, the glow behind the globe (`WorldCanvas.tsx` `GlobeGlow`). It follows the globe's area by rewriting `left`, `top` and `width` on every frame the area moves, which is a layout change every scroll frame.                                                              |
| 2   | The first scroll on a phone stutters: 83–150 ms frames on every page at 390, including static docs | All pages at 390 (4× CPU)                                                                                        | High: a 100–125 ms freeze right as the visitor starts scrolling                             | On phones, the 3D world boots on the first `scroll` or `touchstart`, or after 4.5 s, even on pages with no 3D. That boot (worker, three.js init, canvas) is a single ~124 ms task, and it lands on the scroll itself. `Warmup` also parses the 3D films' code in idle time on phones. |
| 3   | Start-up long tasks: 3–5 tasks of 55–125 ms per page                                               | All pages at 390                                                                                                 | Medium: input is delayed for about 0.5 s after load                                         | Two of them are hydration and chunk evaluation of the root layout (136 ms and 415 ms after navigation). The third is item 2. The homepage adds a scroll-driven `setState` in "How it works" (`Story.tsx`), which re-renders the whole pinned section on every scroll frame.           |
| 4   | `/demos` runs at 30 fps the whole time (transition p95 33 ms) and has one 300 ms frame at 390      | `/demos` at both widths                                                                                          | Medium: visibly choppy                                                                      | Four `autoPlay` preview videos (about 7 MB of WebM) decode at once, on screen or not.                                                                                                                                                                                                 |
| 5   | The diagnostics HUD's top bar shifts after load: CLS 0.11 at 1440                                  | `/diagnostics`                                                                                                   | Low–medium: a visible jump of the domain field and links                                    | The stage column (`div.hidden.min-h-0.flex-1`) and the top bar's controls reflow when the HUD's client state arrives. No space is reserved for them.                                                                                                                                  |
| 6   | The scanner's input jumps: CLS 0.097 at 390                                                        | `/demo/scanner`                                                                                                  | Low                                                                                         | The textarea and its chip rows (`div.inline-flex.flex-wrap`) re-wrap after hydration.                                                                                                                                                                                                 |
| 7   | Translucent 3D layers can flicker where they overlap                                               | Globe, Proof Chain, handshake, pipeline stage                                                                    | Low: depends on the viewing angle                                                           | 22 transparent materials still wrote depth. Layered translucent geometry had no explicit `renderOrder`.                                                                                                                                                                               |
| 8   | Smaller frame hitches inside 3D scenes                                                             | Scenes in motion                                                                                                 | Low, but they add up: GC pauses                                                             | Per-frame allocations in `useFrame`: `new Vector3` and `[x,y,z]` arrays in about ten scenes, and `Array.filter` on the arcs' packet list every frame.                                                                                                                                 |
| 9   | Panels and nav repaint heavily over the moving 3D                                                  | Nav (sticky), diagnostics HUD panels                                                                             | Low on desktop, worse on phones                                                             | `backdrop-filter: blur` on the sticky nav and on the HUD panels. The panels also tilt. The blur is recomputed every frame something moves underneath.                                                                                                                                 |
| 10  | No recovery if the GPU drops the context                                                           | All 3D                                                                                                           | Rare but total: the canvas would stay blank                                                 | No `webglcontextlost` handling. No poster behind the 3D areas, which are empty boxes until the scene's first frame.                                                                                                                                                                   |
| —   | The console error on `/this-page-does-not-exist`                                                   | 404 page                                                                                                         | Not a glitch                                                                                | The browser logs the 404 status of the page the audit requested on purpose.                                                                                                                                                                                                           |

Not found: hydration warnings, WebGL driver warnings, context loss in the runs, and failed requests
apart from the intentional 404.

## Details

### `/` at 390 (score 243)

- long tasks: 125, 69, 73, 105, 70 ms
- layout shift 0.5593: div.ambient.opacity-0.transition-opacity
- layout shift 0.5485: div.ambient.opacity-0.transition-opacity
- layout shift 0.0709: div.ambient.opacity-0.transition-opacity
- layout shift 0.0285: div.ambient.opacity-0.transition-opacity
- layout shift 0.0012: div.ml-auto.flex.flex-wrap, (text)

### `/` at 1440 (score 135)

- layout shift 0.1935: div.ambient.opacity-0.transition-opacity
- layout shift 0.1484: div.ambient.opacity-0.transition-opacity
- layout shift 0.1214: div.ambient.opacity-0.transition-opacity
- layout shift 0.1091: div.ambient.opacity-0.transition-opacity
- layout shift 0.1089: div.ambient.opacity-0.transition-opacity

### `/demo/deploy` at 390 (score 94)

- long tasks: 56, 86, 96 ms
- layout shift 0.043: div.ambient.opacity-0.transition-opacity
- layout shift 0.043: div.ambient.opacity-0.transition-opacity
- layout shift 0.043: div.ambient.opacity-0.transition-opacity
- layout shift 0.043: div.ambient.opacity-0.transition-opacity
- layout shift 0.043: div.ambient.opacity-0.transition-opacity

### `/demos` at 390 (score 53)

- long tasks: 67, 86, 98 ms

### `/platform` at 1440 (score 38)

- layout shift 0.0669: div.ambient.opacity-0.transition-opacity
- layout shift 0.0467: div.ambient.opacity-0.transition-opacity
- layout shift 0.0427: div.ambient.opacity-0.transition-opacity
- layout shift 0.0349: div.ambient.opacity-0.transition-opacity
- layout shift 0.0185: div.ambient.opacity-0.transition-opacity

### `/this-page-does-not-exist` at 390 (score 35)

- console error: Failed to load resource: the server responded with a status of 404 (Not Found)
- long tasks: 68, 84, 94 ms
- failed: /this-page-does-not-exist (HTTP 404)

### `/solutions/healthcare` at 390 (score 25)

- long tasks: 68, 87, 96, 72 ms
- layout shift 0.0309: div.ambient.opacity-0.transition-opacity
- layout shift 0.0244: div.ambient.opacity-0.transition-opacity

### `/this-page-does-not-exist` at 1440 (score 25)

- console error: Failed to load resource: the server responded with a status of 404 (Not Found)
- failed: /this-page-does-not-exist (HTTP 404)

### `/solutions` at 390 (score 24)

- long tasks: 71, 87, 95, 76 ms
- layout shift 0.0188: div.ambient.opacity-0.transition-opacity
- layout shift 0.0164: div.ambient.opacity-0.transition-opacity
- layout shift 0.0142: div.ambient.opacity-0.transition-opacity

### `/solutions/fintech` at 390 (score 24)

- long tasks: 68, 87, 94, 77 ms
- layout shift 0.0291: div.ambient.opacity-0.transition-opacity

### `/solutions/education` at 390 (score 24)

- long tasks: 71, 85, 98, 76 ms
- layout shift 0.0271: div.ambient.opacity-0.transition-opacity

### `/solutions/government` at 390 (score 24)

- long tasks: 70, 87, 96, 77 ms
- layout shift 0.0286: div.ambient.opacity-0.transition-opacity

### `/about` at 390 (score 24)

- long tasks: 70, 86, 100, 78 ms
- layout shift 0.0221: div.ambient.opacity-0.transition-opacity
- layout shift 0.018: div.ambient.opacity-0.transition-opacity

### `/demo/scanner` at 390 (score 22)

- long tasks: 69, 86, 95 ms
- layout shift 0.0968: textarea#scan-input.h-stage-sm.w-full.resize-y, div.inline-flex.flex-wrap.rounded-sm, div.flex.flex-wrap.gap-3

### `/platform` at 390 (score 21)

- long tasks: 69, 87, 99, 106 ms

### `/index` at 390 (score 21)

- long tasks: 72, 87, 98, 51 ms
- layout shift 0.0235: div.ambient.opacity-0.transition-opacity

### `/index` at 1440 (score 20)

- layout shift 0.0202: div.ambient.opacity-0.transition-opacity
- layout shift 0.0202: div.ambient.opacity-0.transition-opacity
- layout shift 0.0186: div.ambient.opacity-0.transition-opacity
- layout shift 0.0127: div.ambient.opacity-0.transition-opacity
- layout shift 0.0101: div.ambient.opacity-0.transition-opacity

### `/demo/how-it-works` at 390 (score 16)

- long tasks: 69, 71, 103 ms

### `/demo/qday` at 390 (score 16)

- long tasks: 70, 72, 105 ms
- layout shift 0.0096: li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3

### `/demo/ledger` at 390 (score 16)

- long tasks: 71, 72, 107 ms

### `/contact` at 390 (score 13)

- long tasks: 70, 84, 96 ms

### `/privacy` at 390 (score 13)

- long tasks: 68, 85, 96 ms

### `/terms` at 390 (score 13)

- long tasks: 75, 96, 105 ms

### `/diagnostics` at 1440 (score 12)

- layout shift 0.0761: div.hidden.min-h-0.flex-1, form.flex.items-center.gap-2, div.ml-auto.flex.flex-wrap, a.flex.items-center.gap-2, div.flex.items-center.border
- layout shift 0.0328: div.hidden.min-h-0.flex-1, form.flex.items-center.gap-2, div.ml-auto.flex.flex-wrap, a.flex.items-center.gap-2, div.flex.items-center.border
- layout shift 0.0011: button.hidden.h-8.rounded-sm, button.h-8.rounded-sm.border, (text), dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right

### `/pricing` at 390 (score 10)

- long tasks: 67, 85, 95 ms

### `/security` at 390 (score 10)

- long tasks: 68, 86, 98 ms

### `/changelog` at 390 (score 10)

- long tasks: 74, 94, 96 ms

### `/docs/api` at 390 (score 10)

- long tasks: 68, 87, 98 ms

### `/docs` at 390 (score 10)

- long tasks: 68, 87, 98 ms

### `/docs/security-model` at 390 (score 10)

- long tasks: 56, 88, 97 ms

### `/docs/adapters/edge` at 390 (score 10)

- long tasks: 75, 90, 98 ms

### `/docs/adapters/sdk` at 390 (score 10)

- long tasks: 69, 84, 95 ms

### `/docs/adapters/shield` at 390 (score 10)

- long tasks: 68, 85, 97 ms

### `/docs/adapters/vault` at 390 (score 10)

- long tasks: 68, 86, 96 ms

### `/docs/adapters/web` at 390 (score 10)

- long tasks: 67, 86, 97 ms

### `/docs/concepts/hybrid-kem` at 390 (score 10)

- long tasks: 68, 84, 97 ms

### `/docs/concepts` at 390 (score 10)

- long tasks: 67, 85, 96 ms

### `/docs/concepts/key-rotation` at 390 (score 10)

- long tasks: 68, 84, 103 ms

### `/docs/concepts/sessions` at 390 (score 10)

- long tasks: 62, 85, 96 ms

### `/docs/concepts/signatures` at 390 (score 10)

- long tasks: 69, 84, 95 ms

### `/pitch` at 390 (score 10)

- long tasks: 56, 84, 98 ms
- layout shift 0.005: div.col-span-12.animate-reveal.space-y-10

### `/scan/www.irctc.co.in` at 390 (score 10)

- long tasks: 57, 83, 96 ms

### `/demo/deploy` at 1440 (score 5)

- layout shift 0.0338: div.ambient.opacity-0.transition-opacity
- layout shift 0.0171: div.ambient.opacity-0.transition-opacity
- layout shift 0.0168: div.ambient.opacity-0.transition-opacity
- layout shift 0.0095: div.ambient.opacity-0.transition-opacity

### `/diagnostics` at 390 (score 4)

- long tasks: 74, 74, 117, 57 ms
- layout shift 0.0124: button.h-7.rounded-sm.border, button.h-7.rounded-sm.border, dd.min-w-0.truncate.text-right, button.h-7.rounded-sm.border, dd.min-w-0.truncate.text-right
- layout shift 0.0077: div.absolute.bottom-3.left-3, dd.min-w-0.truncate.text-right
- layout shift 0.0073: div.flex.snap-x.snap-mandatory, div.absolute.bottom-3.left-3
- layout shift 0.0069: button.h-8.rounded-sm.border, (text), dd.min-w-0.truncate.text-right
- layout shift 0.0053: button.h-8.rounded-sm.border, button.h-8.rounded-sm.border, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right

### `/join` at 390 (score 2)

- long tasks: 69, 85 ms
