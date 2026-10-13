# Glitch audit (after)

`pnpm audit:glitch after` against the production build at http://localhost:3000, 2026-10-12T18:08 UTC.
Every page at 1440×900, and at 390×844 with 4× CPU throttling. Each run: load, scroll to the end, the
page's main action (Play, Verify, Tamper, Scan… or hover across it), 10 s in all. Videos are in
`docs/smooth/videos-after/` (not committed).

## Totals

|                                  | 1440   | 390 (4× CPU) |
| -------------------------------- | ------ | ------------ |
| Console errors + page errors     | 1      | 1            |
| Console warnings                 | 0      | 0            |
| Hydration warnings               | 0      | 0            |
| WebGL driver messages            | 0      | 0            |
| WebGL contexts lost              | 0      | 0            |
| Long tasks > 50 ms               | 15     | 71           |
| Worst frame while scrolling (ms) | 233    | 50           |
| Worst frame in a transition (ms) | 283    | 33           |
| Worst page CLS                   | 0.0131 | 0.0364       |
| Failed requests                  | 1      | 1            |

## Against the targets

Same audit and method as `audit-before.md`: 78 runs, every page at 1440 and at 390 with 4× CPU.

| Target                             | Before                                                        | After                                                                   | Met?                                                                    |
| ---------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Zero console errors                | 1 per width: the 404 page's own status, logged by the browser | Same, and nothing else                                                  | Yes (the 404 is the audit requesting a missing page on purpose)         |
| Zero hydration warnings            | 0                                                             | 0                                                                       | Yes                                                                     |
| No WebGL context loss              | 0                                                             | 0 (and loss is now handled: poster, then rebuild)                       | Yes                                                                     |
| No frame over 50 ms in transitions | 100 ms (390), 33 ms (1440)                                    | 33 ms (390), 17 ms (1440, re-measured, see below)                       | Yes                                                                     |
| 60 fps while scrolling             | p95 16.8 ms; worst 300 ms (390) and 50 ms (1440)              | p95 16.8 ms; worst 50 ms (390: one frame on the homepage), 17 ms (1440) | Yes at p95. At 390 with 4× CPU, one 50 ms frame remains on the homepage |
| CLS under 0.05                     | 1.209 (390), 0.726 (1440)                                     | 0.036 (390, `/diagnostics`), 0.013 (1440, `/join`)                      | Yes, on every page                                                      |
| INP under 100 ms                   | not measured                                                  | 32 ms worst at 1440; 64 ms worst at 390 with 4× CPU (see below)         | Yes                                                                     |

**The 1440 re-measurement.** In this run, `/demo/deploy`, `/solutions` and `/diagnostics` at 1440 each
logged one 233–283 ms frame. These were taken while the site was open in a second browser on the same
machine. Re-run alone (`ONLY=/demo/deploy,/solutions,/diagnostics,/demo/ledger pnpm audit:glitch check`),
all four pages measured a 17 ms worst frame in both scrolling and transitions.

**INP.** Event Timing (`PerformanceObserver` type `event`, max duration per interaction) on each page's
main action, measured 3 s after load: the homepage tour button, each demo's Try it, the scanner's Scan,
and the HUD's → plus five slider steps.

|             | `/`   | how-it-works | deploy | qday  | ledger | scanner | diagnostics |
| ----------- | ----- | ------------ | ------ | ----- | ------ | ------- | ----------- |
| 1440        | 32 ms | 32 ms        | 32 ms  | 32 ms | 32 ms  | 32 ms   | 16 ms       |
| 390, 4× CPU | 64 ms | 32 ms        | 24 ms  | 40 ms | 40 ms  | 32 ms   | 24 ms       |

**What's left.** At 390 with 4× CPU, most pages log three long tasks shortly after load (profiled on `/docs` and `/demo/ledger`: at about 0.3 s and 0.8 s):
hydration of the root layout (~60–90 ms) and the 3D boot (~200 ms), which runs in idle time once a 3D
area is near. They no longer land on scrolling or on a transition (above). Splitting the 3D boot
further would mean compiling shaders lazily, which brings back the first-frame hitch that `<Preload>`
removes.

## Ranked (worst first)

| #   | Page                          | Width | Score | Errors | Hydration | Lost | Long tasks  | Scroll worst / p95 (ms) | Transition worst / p95 (ms) | CLS    | Failed |
| --- | ----------------------------- | ----- | ----- | ------ | --------- | ---- | ----------- | ----------------------- | --------------------------- | ------ | ------ |
| 1   | `/demo/deploy`                | 1440  | 48    | 0      | 0         | 0    | 1 (max 71)  | 17 / 16.7               | 283 / 283.3                 | 0      | 0      |
| 2   | `/solutions`                  | 1440  | 38    | 0      | 0         | 0    | 1 (max 69)  | 17 / 16.8               | 233 / 16.8                  | 0      | 0      |
| 3   | `/diagnostics`                | 1440  | 38    | 0      | 0         | 0    | 1 (max 73)  | 233 / 16.7              | 17 / 16.7                   | 0.0033 | 0      |
| 4   | `/this-page-does-not-exist`   | 390   | 26    | 1      | 0         | 0    | 1 (max 57)  | 17 / 16.7               | 17 / 16.8                   | 0      | 1      |
| 5   | `/this-page-does-not-exist`   | 1440  | 25    | 1      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 1      |
| 6   | `/demo/ledger`                | 1440  | 11    | 0      | 0         | 0    | 1 (max 73)  | 17 / 16.8               | 100 / 16.7                  | 0.0016 | 0      |
| 7   | `/`                           | 390   | 6     | 0      | 0         | 0    | 6 (max 318) | 50 / 16.8               | 33 / 16.7                   | 0.0001 | 0      |
| 8   | `/platform`                   | 390   | 4     | 0      | 0         | 0    | 4 (max 205) | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 9   | `/solutions`                  | 390   | 3     | 0      | 0         | 0    | 3 (max 212) | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 10  | `/solutions/fintech`          | 390   | 3     | 0      | 0         | 0    | 3 (max 203) | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 11  | `/solutions/healthcare`       | 390   | 3     | 0      | 0         | 0    | 3 (max 196) | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 12  | `/solutions/education`        | 390   | 3     | 0      | 0         | 0    | 3 (max 195) | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 13  | `/solutions/government`       | 390   | 3     | 0      | 0         | 0    | 3 (max 201) | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 14  | `/diagnostics`                | 390   | 3     | 0      | 0         | 0    | 3 (max 215) | 17 / 16.7               | 17 / 16.7                   | 0.0364 | 0      |
| 15  | `/index`                      | 390   | 3     | 0      | 0         | 0    | 3 (max 200) | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 16  | `/demo/how-it-works`          | 390   | 3     | 0      | 0         | 0    | 3 (max 206) | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 17  | `/demo/deploy`                | 390   | 3     | 0      | 0         | 0    | 3 (max 269) | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 18  | `/demo/qday`                  | 390   | 3     | 0      | 0         | 0    | 3 (max 209) | 17 / 16.8               | 17 / 16.8                   | 0.0099 | 0      |
| 19  | `/demo/ledger`                | 390   | 3     | 0      | 0         | 0    | 3 (max 231) | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 20  | `/about`                      | 390   | 3     | 0      | 0         | 0    | 3 (max 190) | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 21  | `/`                           | 1440  | 1     | 0      | 0         | 0    | 1 (max 82)  | 17 / 16.8               | 17 / 16.8                   | 0.0067 | 0      |
| 22  | `/platform`                   | 1440  | 1     | 0      | 0         | 0    | 1 (max 69)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 23  | `/solutions/fintech`          | 1440  | 1     | 0      | 0         | 0    | 1 (max 69)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 24  | `/solutions/healthcare`       | 1440  | 1     | 0      | 0         | 0    | 1 (max 69)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 25  | `/solutions/education`        | 1440  | 1     | 0      | 0         | 0    | 1 (max 71)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 26  | `/solutions/government`       | 1440  | 1     | 0      | 0         | 0    | 1 (max 69)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 27  | `/index`                      | 1440  | 1     | 0      | 0         | 0    | 1 (max 70)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 28  | `/demo/how-it-works`          | 1440  | 1     | 0      | 0         | 0    | 1 (max 72)  | 17 / 16.8               | 17 / 16.7                   | 0.0013 | 0      |
| 29  | `/demo/qday`                  | 1440  | 1     | 0      | 0         | 0    | 1 (max 73)  | 17 / 16.7               | 17 / 16.8                   | 0.002  | 0      |
| 30  | `/about`                      | 1440  | 1     | 0      | 0         | 0    | 1 (max 74)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 31  | `/pitch`                      | 1440  | 1     | 0      | 0         | 0    | 1 (max 80)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 32  | `/demos`                      | 390   | 1     | 0      | 0         | 0    | 1 (max 88)  | 33 / 16.8               | 33 / 33.4                   | 0      | 0      |
| 33  | `/demo/scanner`               | 390   | 1     | 0      | 0         | 0    | 1 (max 61)  | 17 / 16.7               | 17 / 16.8                   | 0.0234 | 0      |
| 34  | `/pricing`                    | 390   | 1     | 0      | 0         | 0    | 1 (max 57)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 35  | `/security`                   | 390   | 1     | 0      | 0         | 0    | 1 (max 57)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 36  | `/changelog`                  | 390   | 1     | 0      | 0         | 0    | 1 (max 81)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 37  | `/contact`                    | 390   | 1     | 0      | 0         | 0    | 1 (max 57)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 38  | `/privacy`                    | 390   | 1     | 0      | 0         | 0    | 1 (max 55)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 39  | `/terms`                      | 390   | 1     | 0      | 0         | 0    | 1 (max 90)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 40  | `/docs/api`                   | 390   | 1     | 0      | 0         | 0    | 1 (max 58)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 41  | `/docs`                       | 390   | 1     | 0      | 0         | 0    | 1 (max 58)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 42  | `/docs/security-model`        | 390   | 1     | 0      | 0         | 0    | 1 (max 58)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 43  | `/docs/adapters/edge`         | 390   | 1     | 0      | 0         | 0    | 1 (max 87)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 44  | `/docs/adapters/sdk`          | 390   | 1     | 0      | 0         | 0    | 1 (max 90)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 45  | `/docs/adapters/shield`       | 390   | 1     | 0      | 0         | 0    | 1 (max 87)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 46  | `/docs/adapters/vault`        | 390   | 1     | 0      | 0         | 0    | 1 (max 60)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 47  | `/docs/adapters/web`          | 390   | 1     | 0      | 0         | 0    | 1 (max 59)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 48  | `/docs/concepts/hybrid-kem`   | 390   | 1     | 0      | 0         | 0    | 1 (max 57)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 49  | `/docs/concepts`              | 390   | 1     | 0      | 0         | 0    | 1 (max 61)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 50  | `/docs/concepts/key-rotation` | 390   | 1     | 0      | 0         | 0    | 1 (max 61)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 51  | `/docs/concepts/sessions`     | 390   | 1     | 0      | 0         | 0    | 1 (max 62)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 52  | `/docs/concepts/signatures`   | 390   | 1     | 0      | 0         | 0    | 1 (max 58)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 53  | `/join`                       | 390   | 1     | 0      | 0         | 0    | 1 (max 57)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 54  | `/pitch`                      | 390   | 1     | 0      | 0         | 0    | 1 (max 58)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 55  | `/scan/www.irctc.co.in`       | 390   | 1     | 0      | 0         | 0    | 1 (max 59)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 56  | `/demos`                      | 1440  | 0     | 0      | 0         | 0    | 0           | 33 / 16.8               | 33 / 33.4                   | 0      | 0      |
| 57  | `/demo/scanner`               | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0.0003 | 0      |
| 58  | `/pricing`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 59  | `/security`                   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 60  | `/changelog`                  | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 61  | `/contact`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 62  | `/privacy`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 63  | `/terms`                      | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 64  | `/docs/api`                   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 65  | `/docs`                       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 66  | `/docs/security-model`        | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 67  | `/docs/adapters/edge`         | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 68  | `/docs/adapters/sdk`          | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 69  | `/docs/adapters/shield`       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 70  | `/docs/adapters/vault`        | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 71  | `/docs/adapters/web`          | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 72  | `/docs/concepts/hybrid-kem`   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 73  | `/docs/concepts`              | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 74  | `/docs/concepts/key-rotation` | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 75  | `/docs/concepts/sessions`     | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 76  | `/docs/concepts/signatures`   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 77  | `/join`                       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0.0131 | 0      |
| 78  | `/scan/www.irctc.co.in`       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |

## Details

### `/demo/deploy` at 1440 (score 48)

- long tasks: 71 ms

### `/solutions` at 1440 (score 38)

- long tasks: 69 ms

### `/diagnostics` at 1440 (score 38)

- long tasks: 73 ms
- layout shift 0.0011: button.hidden.h-8.rounded-sm, button.h-8.rounded-sm.border, (text), dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right

### `/this-page-does-not-exist` at 390 (score 26)

- console error: Failed to load resource: the server responded with a status of 404 (Not Found)
- long tasks: 57 ms
- failed: /this-page-does-not-exist (HTTP 404)

### `/this-page-does-not-exist` at 1440 (score 25)

- console error: Failed to load resource: the server responded with a status of 404 (Not Found)
- failed: /this-page-does-not-exist (HTTP 404)

### `/demo/ledger` at 1440 (score 11)

- long tasks: 73 ms
- layout shift 0.0015: div.ml-auto.flex.flex-wrap, div.pr-6.md:border-l.md:border-line, div.pr-6.md:border-l.md:border-line, div.pr-6., div.pr-6.md:border-l.md:border-line

### `/` at 390 (score 6)

- long tasks: 150, 62, 60, 85, 318, 58 ms

### `/platform` at 390 (score 4)

- long tasks: 52, 56, 88, 205 ms

### `/solutions` at 390 (score 3)

- long tasks: 86, 89, 212 ms

### `/solutions/fintech` at 390 (score 3)

- long tasks: 60, 91, 203 ms

### `/solutions/healthcare` at 390 (score 3)

- long tasks: 61, 92, 196 ms

### `/solutions/education` at 390 (score 3)

- long tasks: 62, 84, 195 ms

### `/solutions/government` at 390 (score 3)

- long tasks: 60, 89, 201 ms

### `/diagnostics` at 390 (score 3)

- long tasks: 61, 76, 215 ms
- layout shift 0.0077: div.absolute.bottom-3.left-3, dd.min-w-0.truncate.text-right
- layout shift 0.0073: div.flex.snap-x.snap-mandatory, div.absolute.bottom-3.left-3
- layout shift 0.0069: button.h-8.rounded-sm.border, (text), dd.min-w-0.truncate.text-right
- layout shift 0.0053: button.h-8.rounded-sm.border, button.h-8.rounded-sm.border, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right
- layout shift 0.0045: div.flex.snap-x.snap-mandatory, div.absolute.bottom-3.left-3

### `/index` at 390 (score 3)

- long tasks: 62, 91, 200 ms

### `/demo/how-it-works` at 390 (score 3)

- long tasks: 60, 74, 206 ms

### `/demo/deploy` at 390 (score 3)

- long tasks: 64, 93, 269 ms

### `/demo/qday` at 390 (score 3)

- long tasks: 60, 77, 209 ms
- layout shift 0.0096: li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3

### `/demo/ledger` at 390 (score 3)

- long tasks: 73, 79, 231 ms

### `/about` at 390 (score 3)

- long tasks: 85, 88, 190 ms

### `/` at 1440 (score 1)

- long tasks: 82 ms
- layout shift 0.0067: div.mt-8

### `/platform` at 1440 (score 1)

- long tasks: 69 ms

### `/solutions/fintech` at 1440 (score 1)

- long tasks: 69 ms

### `/solutions/healthcare` at 1440 (score 1)

- long tasks: 69 ms

### `/solutions/education` at 1440 (score 1)

- long tasks: 71 ms

### `/solutions/government` at 1440 (score 1)

- long tasks: 69 ms

### `/index` at 1440 (score 1)

- long tasks: 70 ms

### `/demo/how-it-works` at 1440 (score 1)

- long tasks: 72 ms

### `/demo/qday` at 1440 (score 1)

- long tasks: 73 ms
- layout shift 0.002: li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3

### `/about` at 1440 (score 1)

- long tasks: 74 ms

### `/pitch` at 1440 (score 1)

- long tasks: 80 ms

### `/demos` at 390 (score 1)

- long tasks: 88 ms

### `/demo/scanner` at 390 (score 1)

- long tasks: 61 ms
- layout shift 0.0234: textarea#scan-input.h-stage-sm.w-full.resize-y, div.inline-flex.flex-wrap.rounded-sm

### `/pricing` at 390 (score 1)

- long tasks: 57 ms

### `/security` at 390 (score 1)

- long tasks: 57 ms

### `/changelog` at 390 (score 1)

- long tasks: 81 ms

### `/contact` at 390 (score 1)

- long tasks: 57 ms

### `/privacy` at 390 (score 1)

- long tasks: 55 ms

### `/terms` at 390 (score 1)

- long tasks: 90 ms

### `/docs/api` at 390 (score 1)

- long tasks: 58 ms

### `/docs` at 390 (score 1)

- long tasks: 58 ms

### `/docs/security-model` at 390 (score 1)

- long tasks: 58 ms

### `/docs/adapters/edge` at 390 (score 1)

- long tasks: 87 ms

### `/docs/adapters/sdk` at 390 (score 1)

- long tasks: 90 ms

### `/docs/adapters/shield` at 390 (score 1)

- long tasks: 87 ms

### `/docs/adapters/vault` at 390 (score 1)

- long tasks: 60 ms

### `/docs/adapters/web` at 390 (score 1)

- long tasks: 59 ms

### `/docs/concepts/hybrid-kem` at 390 (score 1)

- long tasks: 57 ms

### `/docs/concepts` at 390 (score 1)

- long tasks: 61 ms

### `/docs/concepts/key-rotation` at 390 (score 1)

- long tasks: 61 ms

### `/docs/concepts/sessions` at 390 (score 1)

- long tasks: 62 ms

### `/docs/concepts/signatures` at 390 (score 1)

- long tasks: 58 ms

### `/join` at 390 (score 1)

- long tasks: 57 ms

### `/pitch` at 390 (score 1)

- long tasks: 58 ms

### `/scan/www.irctc.co.in` at 390 (score 1)

- long tasks: 59 ms
