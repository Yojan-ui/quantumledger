# Glitch audit (wow)

`pnpm audit:glitch wow` against the production build at http://localhost:3000, 2026-10-13T18:48 UTC.
Every page at 1440×900, and at 390×844 with 4× CPU throttling. Each run: load, scroll to the end, the
page's main action (Play, Verify, Tamper, Scan… or hover across it), 10 s in all. Videos are in
`docs/smooth/videos-wow/` (not committed).

## Totals

|                                  | 1440  | 390 (4× CPU) |
| -------------------------------- | ----- | ------------ |
| Console errors + page errors     | 1     | 1            |
| Console warnings                 | 0     | 0            |
| Hydration warnings               | 0     | 0            |
| WebGL driver messages            | 0     | 0            |
| WebGL contexts lost              | 0     | 0            |
| Long tasks > 50 ms               | 16    | 73           |
| Worst frame while scrolling (ms) | 150   | 200          |
| Worst frame in a transition (ms) | 33    | 167          |
| Worst page CLS                   | 0.019 | 0.0913       |
| Failed requests                  | 1     | 1            |

## Ranked (worst first)

| #   | Page                          | Width | Score | Errors | Hydration | Lost | Long tasks  | Scroll worst / p95 (ms) | Transition worst / p95 (ms) | CLS    | Failed |
| --- | ----------------------------- | ----- | ----- | ------ | --------- | ---- | ----------- | ----------------------- | --------------------------- | ------ | ------ |
| 1   | `/demos`                      | 390   | 54    | 0      | 0         | 0    | 1 (max 59)  | 200 / 16.8              | 167 / 33.4                  | 0      | 0      |
| 2   | `/this-page-does-not-exist`   | 390   | 26    | 1      | 0         | 0    | 1 (max 56)  | 17 / 16.8               | 17 / 16.7                   | 0      | 1      |
| 3   | `/this-page-does-not-exist`   | 1440  | 25    | 1      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 1      |
| 4   | `/demo/deploy`                | 1440  | 21    | 0      | 0         | 0    | 1 (max 82)  | 150 / 16.7              | 17 / 16.8                   | 0      | 0      |
| 5   | `/diagnostics`                | 390   | 11    | 0      | 0         | 0    | 3 (max 234) | 17 / 16.7               | 17 / 16.8                   | 0.0913 | 0      |
| 6   | `/`                           | 390   | 6     | 0      | 0         | 0    | 6 (max 252) | 17 / 16.8               | 33 / 16.8                   | 0.0061 | 0      |
| 7   | `/solutions`                  | 390   | 4     | 0      | 0         | 0    | 4 (max 214) | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 8   | `/about`                      | 390   | 4     | 0      | 0         | 0    | 4 (max 228) | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 9   | `/platform`                   | 390   | 3     | 0      | 0         | 0    | 3 (max 226) | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 10  | `/solutions/fintech`          | 390   | 3     | 0      | 0         | 0    | 3 (max 204) | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 11  | `/solutions/healthcare`       | 390   | 3     | 0      | 0         | 0    | 3 (max 220) | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 12  | `/solutions/education`        | 390   | 3     | 0      | 0         | 0    | 3 (max 206) | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 13  | `/solutions/government`       | 390   | 3     | 0      | 0         | 0    | 3 (max 200) | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 14  | `/index`                      | 390   | 3     | 0      | 0         | 0    | 3 (max 224) | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 15  | `/demo/how-it-works`          | 390   | 3     | 0      | 0         | 0    | 3 (max 231) | 17 / 16.8               | 17 / 16.7                   | 0.0059 | 0      |
| 16  | `/demo/deploy`                | 390   | 3     | 0      | 0         | 0    | 3 (max 240) | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 17  | `/demo/qday`                  | 390   | 3     | 0      | 0         | 0    | 3 (max 272) | 17 / 16.8               | 17 / 16.8                   | 0.0158 | 0      |
| 18  | `/demo/ledger`                | 390   | 3     | 0      | 0         | 0    | 3 (max 230) | 17 / 16.7               | 33 / 16.8                   | 0      | 0      |
| 19  | `/`                           | 1440  | 2     | 0      | 0         | 0    | 2 (max 128) | 17 / 16.8               | 17 / 16.8                   | 0.0033 | 0      |
| 20  | `/join`                       | 390   | 2     | 0      | 0         | 0    | 2 (max 70)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 21  | `/platform`                   | 1440  | 1     | 0      | 0         | 0    | 1 (max 74)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 22  | `/solutions`                  | 1440  | 1     | 0      | 0         | 0    | 1 (max 74)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 23  | `/solutions/fintech`          | 1440  | 1     | 0      | 0         | 0    | 1 (max 72)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 24  | `/solutions/healthcare`       | 1440  | 1     | 0      | 0         | 0    | 1 (max 75)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 25  | `/solutions/education`        | 1440  | 1     | 0      | 0         | 0    | 1 (max 83)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 26  | `/solutions/government`       | 1440  | 1     | 0      | 0         | 0    | 1 (max 77)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 27  | `/diagnostics`                | 1440  | 1     | 0      | 0         | 0    | 1 (max 87)  | 17 / 16.7               | 17 / 16.7                   | 0.004  | 0      |
| 28  | `/index`                      | 1440  | 1     | 0      | 0         | 0    | 1 (max 75)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 29  | `/demo/how-it-works`          | 1440  | 1     | 0      | 0         | 0    | 1 (max 102) | 17 / 16.8               | 17 / 16.7                   | 0.0091 | 0      |
| 30  | `/demo/qday`                  | 1440  | 1     | 0      | 0         | 0    | 1 (max 82)  | 17 / 16.7               | 17 / 16.7                   | 0.019  | 0      |
| 31  | `/demo/ledger`                | 1440  | 1     | 0      | 0         | 0    | 1 (max 92)  | 17 / 16.7               | 17 / 16.8                   | 0.0016 | 0      |
| 32  | `/about`                      | 1440  | 1     | 0      | 0         | 0    | 1 (max 80)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 33  | `/pitch`                      | 1440  | 1     | 0      | 0         | 0    | 1 (max 94)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 34  | `/demo/scanner`               | 390   | 1     | 0      | 0         | 0    | 1 (max 59)  | 17 / 16.8               | 17 / 16.8                   | 0.0238 | 0      |
| 35  | `/pricing`                    | 390   | 1     | 0      | 0         | 0    | 1 (max 66)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 36  | `/security`                   | 390   | 1     | 0      | 0         | 0    | 1 (max 69)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 37  | `/changelog`                  | 390   | 1     | 0      | 0         | 0    | 1 (max 64)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 38  | `/contact`                    | 390   | 1     | 0      | 0         | 0    | 1 (max 68)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 39  | `/privacy`                    | 390   | 1     | 0      | 0         | 0    | 1 (max 65)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 40  | `/terms`                      | 390   | 1     | 0      | 0         | 0    | 1 (max 58)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 41  | `/docs/api`                   | 390   | 1     | 0      | 0         | 0    | 1 (max 57)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 42  | `/docs`                       | 390   | 1     | 0      | 0         | 0    | 1 (max 56)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 43  | `/docs/security-model`        | 390   | 1     | 0      | 0         | 0    | 1 (max 56)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 44  | `/docs/adapters/edge`         | 390   | 1     | 0      | 0         | 0    | 1 (max 61)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 45  | `/docs/adapters/sdk`          | 390   | 1     | 0      | 0         | 0    | 1 (max 59)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 46  | `/docs/adapters/shield`       | 390   | 1     | 0      | 0         | 0    | 1 (max 58)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 47  | `/docs/adapters/vault`        | 390   | 1     | 0      | 0         | 0    | 1 (max 55)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 48  | `/docs/adapters/web`          | 390   | 1     | 0      | 0         | 0    | 1 (max 56)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 49  | `/docs/concepts/hybrid-kem`   | 390   | 1     | 0      | 0         | 0    | 1 (max 60)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 50  | `/docs/concepts`              | 390   | 1     | 0      | 0         | 0    | 1 (max 56)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 51  | `/docs/concepts/key-rotation` | 390   | 1     | 0      | 0         | 0    | 1 (max 85)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 52  | `/docs/concepts/sessions`     | 390   | 1     | 0      | 0         | 0    | 1 (max 57)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 53  | `/docs/concepts/signatures`   | 390   | 1     | 0      | 0         | 0    | 1 (max 56)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 54  | `/pitch`                      | 390   | 1     | 0      | 0         | 0    | 1 (max 56)  | 17 / 16.7               | 17 / 16.7                   | 0.0083 | 0      |
| 55  | `/scan/www.irctc.co.in`       | 390   | 1     | 0      | 0         | 0    | 1 (max 83)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 56  | `/demos`                      | 1440  | 0     | 0      | 0         | 0    | 0           | 33 / 16.8               | 33 / 33.4                   | 0      | 0      |
| 57  | `/demo/scanner`               | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0.0008 | 0      |
| 58  | `/pricing`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 59  | `/security`                   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 60  | `/changelog`                  | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 61  | `/contact`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 62  | `/privacy`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 63  | `/terms`                      | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 64  | `/docs/api`                   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 65  | `/docs`                       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 66  | `/docs/security-model`        | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 67  | `/docs/adapters/edge`         | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 68  | `/docs/adapters/sdk`          | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 69  | `/docs/adapters/shield`       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 70  | `/docs/adapters/vault`        | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 71  | `/docs/adapters/web`          | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 72  | `/docs/concepts/hybrid-kem`   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 73  | `/docs/concepts`              | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 74  | `/docs/concepts/key-rotation` | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 75  | `/docs/concepts/sessions`     | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 76  | `/docs/concepts/signatures`   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 77  | `/join`                       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0.0132 | 0      |
| 78  | `/scan/www.irctc.co.in`       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |

## Details

### `/demos` at 390 (score 54)

- long tasks: 59 ms

### `/this-page-does-not-exist` at 390 (score 26)

- console error: Failed to load resource: the server responded with a status of 404 (Not Found)
- long tasks: 56 ms
- failed: /this-page-does-not-exist (HTTP 404)

### `/this-page-does-not-exist` at 1440 (score 25)

- console error: Failed to load resource: the server responded with a status of 404 (Not Found)
- failed: /this-page-does-not-exist (HTTP 404)

### `/demo/deploy` at 1440 (score 21)

- long tasks: 82 ms

### `/diagnostics` at 390 (score 11)

- long tasks: 57, 70, 234 ms
- layout shift 0.0773: div.flex.snap-x.snap-mandatory, svg, div.absolute.bottom-3.left-3, button.ml-auto.h-8.px-2, button.h-8.rounded-sm.border
- layout shift 0.0077: div.absolute.bottom-3.left-3, dd.min-w-0.truncate.text-right
- layout shift 0.0027: dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, (text)
- layout shift 0.0021: dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, (text)
- layout shift 0.0013: div.absolute.bottom-3.left-3

### `/` at 390 (score 6)

- long tasks: 151, 103, 59, 81, 252, 60 ms
- layout shift 0.0054: div.absolute.right-5.top-6

### `/solutions` at 390 (score 4)

- long tasks: 61, 93, 214, 53 ms

### `/about` at 390 (score 4)

- long tasks: 65, 95, 228, 53 ms

### `/platform` at 390 (score 3)

- long tasks: 64, 96, 226 ms

### `/solutions/fintech` at 390 (score 3)

- long tasks: 70, 93, 204 ms

### `/solutions/healthcare` at 390 (score 3)

- long tasks: 55, 87, 220 ms

### `/solutions/education` at 390 (score 3)

- long tasks: 60, 86, 206 ms

### `/solutions/government` at 390 (score 3)

- long tasks: 58, 87, 200 ms

### `/index` at 390 (score 3)

- long tasks: 65, 89, 224 ms

### `/demo/how-it-works` at 390 (score 3)

- long tasks: 65, 78, 231 ms
- layout shift 0.0059: div.pointer-events-none.absolute.inset-x-0

### `/demo/deploy` at 390 (score 3)

- long tasks: 66, 95, 240 ms

### `/demo/qday` at 390 (score 3)

- long tasks: 77, 81, 272 ms
- layout shift 0.0096: li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3
- layout shift 0.0059: div.pointer-events-none.absolute.inset-x-0

### `/demo/ledger` at 390 (score 3)

- long tasks: 64, 83, 230 ms

### `/` at 1440 (score 2)

- long tasks: 51, 128 ms
- layout shift 0.0023: div.mt-8

### `/join` at 390 (score 2)

- long tasks: 70, 65 ms

### `/platform` at 1440 (score 1)

- long tasks: 74 ms

### `/solutions` at 1440 (score 1)

- long tasks: 74 ms

### `/solutions/fintech` at 1440 (score 1)

- long tasks: 72 ms

### `/solutions/healthcare` at 1440 (score 1)

- long tasks: 75 ms

### `/solutions/education` at 1440 (score 1)

- long tasks: 83 ms

### `/solutions/government` at 1440 (score 1)

- long tasks: 77 ms

### `/diagnostics` at 1440 (score 1)

- long tasks: 87 ms

### `/index` at 1440 (score 1)

- long tasks: 75 ms

### `/demo/how-it-works` at 1440 (score 1)

- long tasks: 102 ms
- layout shift 0.0061: div.pointer-events-none.absolute.inset-x-0

### `/demo/qday` at 1440 (score 1)

- long tasks: 82 ms
- layout shift 0.0122: div.pointer-events-none.absolute.inset-x-0
- layout shift 0.003: li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3

### `/demo/ledger` at 1440 (score 1)

- long tasks: 92 ms

### `/about` at 1440 (score 1)

- long tasks: 80 ms

### `/pitch` at 1440 (score 1)

- long tasks: 94 ms

### `/demo/scanner` at 390 (score 1)

- long tasks: 59 ms
- layout shift 0.0238: textarea#scan-input.h-stage-sm.w-full.resize-y, div.inline-flex.flex-wrap.rounded-sm

### `/pricing` at 390 (score 1)

- long tasks: 66 ms

### `/security` at 390 (score 1)

- long tasks: 69 ms

### `/changelog` at 390 (score 1)

- long tasks: 64 ms

### `/contact` at 390 (score 1)

- long tasks: 68 ms

### `/privacy` at 390 (score 1)

- long tasks: 65 ms

### `/terms` at 390 (score 1)

- long tasks: 58 ms

### `/docs/api` at 390 (score 1)

- long tasks: 57 ms

### `/docs` at 390 (score 1)

- long tasks: 56 ms

### `/docs/security-model` at 390 (score 1)

- long tasks: 56 ms

### `/docs/adapters/edge` at 390 (score 1)

- long tasks: 61 ms

### `/docs/adapters/sdk` at 390 (score 1)

- long tasks: 59 ms

### `/docs/adapters/shield` at 390 (score 1)

- long tasks: 58 ms

### `/docs/adapters/vault` at 390 (score 1)

- long tasks: 55 ms

### `/docs/adapters/web` at 390 (score 1)

- long tasks: 56 ms

### `/docs/concepts/hybrid-kem` at 390 (score 1)

- long tasks: 60 ms

### `/docs/concepts` at 390 (score 1)

- long tasks: 56 ms

### `/docs/concepts/key-rotation` at 390 (score 1)

- long tasks: 85 ms

### `/docs/concepts/sessions` at 390 (score 1)

- long tasks: 57 ms

### `/docs/concepts/signatures` at 390 (score 1)

- long tasks: 56 ms

### `/pitch` at 390 (score 1)

- long tasks: 56 ms
- layout shift 0.0083: div.col-span-12.animate-reveal.space-y-10

### `/scan/www.irctc.co.in` at 390 (score 1)

- long tasks: 83 ms
