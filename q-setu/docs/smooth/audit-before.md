# Glitch audit (before)

`pnpm audit:glitch before` against the production build at http://localhost:3000, 2026-10-30T11:23 UTC.
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
| Long tasks > 50 ms               | 15     | 68           |
| Worst frame while scrolling (ms) | 33     | 167          |
| Worst frame in a transition (ms) | 83     | 183          |
| Worst page CLS                   | 0.0131 | 0.0367       |
| Failed requests                  | 1      | 1            |

## Ranked (worst first)

| #   | Page                          | Width | Score | Errors | Hydration | Lost | Long tasks  | Scroll worst / p95 (ms) | Transition worst / p95 (ms) | CLS    | Failed |
| --- | ----------------------------- | ----- | ----- | ------ | --------- | ---- | ----------- | ----------------------- | --------------------------- | ------ | ------ |
| 1   | `/demos`                      | 390   | 51    | 0      | 0         | 0    | 1 (max 82)  | 167 / 16.8              | 183 / 33.4                  | 0      | 0      |
| 2   | `/this-page-does-not-exist`   | 390   | 26    | 1      | 0         | 0    | 1 (max 52)  | 17 / 16.7               | 17 / 16.8                   | 0      | 1      |
| 3   | `/this-page-does-not-exist`   | 1440  | 25    | 1      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 1      |
| 4   | `/demo/qday`                  | 1440  | 8     | 0      | 0         | 0    | 1 (max 76)  | 17 / 16.8               | 83 / 16.8                   | 0.002  | 0      |
| 5   | `/`                           | 390   | 4     | 0      | 0         | 0    | 4 (max 187) | 33 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 6   | `/platform`                   | 390   | 3     | 0      | 0         | 0    | 3 (max 168) | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 7   | `/solutions`                  | 390   | 3     | 0      | 0         | 0    | 3 (max 162) | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 8   | `/solutions/fintech`          | 390   | 3     | 0      | 0         | 0    | 3 (max 165) | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 9   | `/solutions/healthcare`       | 390   | 3     | 0      | 0         | 0    | 3 (max 166) | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 10  | `/solutions/education`        | 390   | 3     | 0      | 0         | 0    | 3 (max 170) | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 11  | `/solutions/government`       | 390   | 3     | 0      | 0         | 0    | 3 (max 166) | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 12  | `/diagnostics`                | 390   | 3     | 0      | 0         | 0    | 3 (max 182) | 17 / 16.8               | 17 / 16.7                   | 0.0367 | 0      |
| 13  | `/index`                      | 390   | 3     | 0      | 0         | 0    | 3 (max 168) | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 14  | `/demo/how-it-works`          | 390   | 3     | 0      | 0         | 0    | 3 (max 178) | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 15  | `/demo/deploy`                | 390   | 3     | 0      | 0         | 0    | 3 (max 166) | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 16  | `/demo/qday`                  | 390   | 3     | 0      | 0         | 0    | 3 (max 182) | 17 / 16.7               | 17 / 16.8                   | 0.0099 | 0      |
| 17  | `/demo/ledger`                | 390   | 3     | 0      | 0         | 0    | 3 (max 178) | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 18  | `/about`                      | 390   | 3     | 0      | 0         | 0    | 3 (max 174) | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 19  | `/`                           | 1440  | 1     | 0      | 0         | 0    | 1 (max 93)  | 17 / 16.7               | 17 / 16.7                   | 0.0073 | 0      |
| 20  | `/platform`                   | 1440  | 1     | 0      | 0         | 0    | 1 (max 68)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 21  | `/solutions`                  | 1440  | 1     | 0      | 0         | 0    | 1 (max 69)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 22  | `/solutions/fintech`          | 1440  | 1     | 0      | 0         | 0    | 1 (max 67)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 23  | `/solutions/healthcare`       | 1440  | 1     | 0      | 0         | 0    | 1 (max 69)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 24  | `/solutions/education`        | 1440  | 1     | 0      | 0         | 0    | 1 (max 69)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 25  | `/solutions/government`       | 1440  | 1     | 0      | 0         | 0    | 1 (max 70)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 26  | `/diagnostics`                | 1440  | 1     | 0      | 0         | 0    | 1 (max 72)  | 17 / 16.7               | 17 / 16.7                   | 0.004  | 0      |
| 27  | `/index`                      | 1440  | 1     | 0      | 0         | 0    | 1 (max 72)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 28  | `/demo/how-it-works`          | 1440  | 1     | 0      | 0         | 0    | 1 (max 74)  | 17 / 16.7               | 17 / 16.7                   | 0.0013 | 0      |
| 29  | `/demo/deploy`                | 1440  | 1     | 0      | 0         | 0    | 1 (max 74)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 30  | `/demo/ledger`                | 1440  | 1     | 0      | 0         | 0    | 1 (max 74)  | 17 / 16.8               | 17 / 16.8                   | 0.0001 | 0      |
| 31  | `/about`                      | 1440  | 1     | 0      | 0         | 0    | 1 (max 85)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 32  | `/pitch`                      | 1440  | 1     | 0      | 0         | 0    | 1 (max 68)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 33  | `/demo/scanner`               | 390   | 1     | 0      | 0         | 0    | 1 (max 54)  | 17 / 16.7               | 33 / 16.8                   | 0.0234 | 0      |
| 34  | `/pricing`                    | 390   | 1     | 0      | 0         | 0    | 1 (max 52)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 35  | `/security`                   | 390   | 1     | 0      | 0         | 0    | 1 (max 52)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 36  | `/changelog`                  | 390   | 1     | 0      | 0         | 0    | 1 (max 51)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 37  | `/contact`                    | 390   | 1     | 0      | 0         | 0    | 1 (max 52)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 38  | `/privacy`                    | 390   | 1     | 0      | 0         | 0    | 1 (max 51)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 39  | `/terms`                      | 390   | 1     | 0      | 0         | 0    | 1 (max 52)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 40  | `/docs/api`                   | 390   | 1     | 0      | 0         | 0    | 1 (max 51)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 41  | `/docs`                       | 390   | 1     | 0      | 0         | 0    | 1 (max 52)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 42  | `/docs/security-model`        | 390   | 1     | 0      | 0         | 0    | 1 (max 60)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 43  | `/docs/adapters/edge`         | 390   | 1     | 0      | 0         | 0    | 1 (max 59)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 44  | `/docs/adapters/sdk`          | 390   | 1     | 0      | 0         | 0    | 1 (max 57)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 45  | `/docs/adapters/shield`       | 390   | 1     | 0      | 0         | 0    | 1 (max 65)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 46  | `/docs/adapters/vault`        | 390   | 1     | 0      | 0         | 0    | 1 (max 52)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 47  | `/docs/adapters/web`          | 390   | 1     | 0      | 0         | 0    | 1 (max 65)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 48  | `/docs/concepts/hybrid-kem`   | 390   | 1     | 0      | 0         | 0    | 1 (max 61)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 49  | `/docs/concepts`              | 390   | 1     | 0      | 0         | 0    | 1 (max 56)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 50  | `/docs/concepts/key-rotation` | 390   | 1     | 0      | 0         | 0    | 1 (max 53)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 51  | `/docs/concepts/sessions`     | 390   | 1     | 0      | 0         | 0    | 1 (max 52)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 52  | `/docs/concepts/signatures`   | 390   | 1     | 0      | 0         | 0    | 1 (max 53)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 53  | `/join`                       | 390   | 1     | 0      | 0         | 0    | 1 (max 52)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 54  | `/pitch`                      | 390   | 1     | 0      | 0         | 0    | 1 (max 80)  | 17 / 16.7               | 17 / 16.7                   | 0.005  | 0      |
| 55  | `/scan/www.irctc.co.in`       | 390   | 1     | 0      | 0         | 0    | 1 (max 53)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 56  | `/demos`                      | 1440  | 0     | 0      | 0         | 0    | 0           | 33 / 16.8               | 33 / 33.4                   | 0      | 0      |
| 57  | `/demo/scanner`               | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0.0006 | 0      |
| 58  | `/pricing`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 59  | `/security`                   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 60  | `/changelog`                  | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 61  | `/contact`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 62  | `/privacy`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 63  | `/terms`                      | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 64  | `/docs/api`                   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 65  | `/docs`                       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 66  | `/docs/security-model`        | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 67  | `/docs/adapters/edge`         | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 68  | `/docs/adapters/sdk`          | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 69  | `/docs/adapters/shield`       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 70  | `/docs/adapters/vault`        | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 71  | `/docs/adapters/web`          | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 72  | `/docs/concepts/hybrid-kem`   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 73  | `/docs/concepts`              | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 74  | `/docs/concepts/key-rotation` | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 75  | `/docs/concepts/sessions`     | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 76  | `/docs/concepts/signatures`   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 77  | `/join`                       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0.0131 | 0      |
| 78  | `/scan/www.irctc.co.in`       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |

## Details

### `/demos` at 390 (score 51)

- long tasks: 82 ms

### `/this-page-does-not-exist` at 390 (score 26)

- console error: Failed to load resource: the server responded with a status of 404 (Not Found)
- long tasks: 52 ms
- failed: /this-page-does-not-exist (HTTP 404)

### `/this-page-does-not-exist` at 1440 (score 25)

- console error: Failed to load resource: the server responded with a status of 404 (Not Found)
- failed: /this-page-does-not-exist (HTTP 404)

### `/demo/qday` at 1440 (score 8)

- long tasks: 76 ms
- layout shift 0.002: li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3

### `/` at 390 (score 4)

- long tasks: 105, 51, 65, 187 ms

### `/platform` at 390 (score 3)

- long tasks: 52, 74, 168 ms

### `/solutions` at 390 (score 3)

- long tasks: 73, 79, 162 ms

### `/solutions/fintech` at 390 (score 3)

- long tasks: 52, 77, 165 ms

### `/solutions/healthcare` at 390 (score 3)

- long tasks: 53, 79, 166 ms

### `/solutions/education` at 390 (score 3)

- long tasks: 52, 77, 170 ms

### `/solutions/government` at 390 (score 3)

- long tasks: 53, 76, 166 ms

### `/diagnostics` at 390 (score 3)

- long tasks: 54, 67, 182 ms
- layout shift 0.0134: div.absolute.bottom-3.left-3, button.h-8.rounded-sm.border, button.h-8.rounded-sm.border, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right
- layout shift 0.0073: div.flex.snap-x.snap-mandatory, div.absolute.bottom-3.left-3
- layout shift 0.0069: button.h-8.rounded-sm.border, (text), dd.min-w-0.truncate.text-right
- layout shift 0.0045: div.flex.snap-x.snap-mandatory, div.absolute.bottom-3.left-3
- layout shift 0.0021: dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, (text)

### `/index` at 390 (score 3)

- long tasks: 52, 76, 168 ms

### `/demo/how-it-works` at 390 (score 3)

- long tasks: 53, 67, 178 ms

### `/demo/deploy` at 390 (score 3)

- long tasks: 52, 78, 166 ms

### `/demo/qday` at 390 (score 3)

- long tasks: 53, 70, 182 ms
- layout shift 0.0096: li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3

### `/demo/ledger` at 390 (score 3)

- long tasks: 53, 66, 178 ms

### `/about` at 390 (score 3)

- long tasks: 53, 76, 174 ms

### `/` at 1440 (score 1)

- long tasks: 93 ms
- layout shift 0.0067: div.mt-8

### `/platform` at 1440 (score 1)

- long tasks: 68 ms

### `/solutions` at 1440 (score 1)

- long tasks: 69 ms

### `/solutions/fintech` at 1440 (score 1)

- long tasks: 67 ms

### `/solutions/healthcare` at 1440 (score 1)

- long tasks: 69 ms

### `/solutions/education` at 1440 (score 1)

- long tasks: 69 ms

### `/solutions/government` at 1440 (score 1)

- long tasks: 70 ms

### `/diagnostics` at 1440 (score 1)

- long tasks: 72 ms
- layout shift 0.0017: p.text-fg-2, button.hidden.h-8.rounded-sm, button.h-8.rounded-sm.border, (text), dd.min-w-0.truncate.text-right

### `/index` at 1440 (score 1)

- long tasks: 72 ms

### `/demo/how-it-works` at 1440 (score 1)

- long tasks: 74 ms

### `/demo/deploy` at 1440 (score 1)

- long tasks: 74 ms

### `/demo/ledger` at 1440 (score 1)

- long tasks: 74 ms

### `/about` at 1440 (score 1)

- long tasks: 85 ms

### `/pitch` at 1440 (score 1)

- long tasks: 68 ms

### `/demo/scanner` at 390 (score 1)

- long tasks: 54 ms
- layout shift 0.0234: textarea#scan-input.h-stage-sm.w-full.resize-y, div.inline-flex.flex-wrap.rounded-sm

### `/pricing` at 390 (score 1)

- long tasks: 52 ms

### `/security` at 390 (score 1)

- long tasks: 52 ms

### `/changelog` at 390 (score 1)

- long tasks: 51 ms

### `/contact` at 390 (score 1)

- long tasks: 52 ms

### `/privacy` at 390 (score 1)

- long tasks: 51 ms

### `/terms` at 390 (score 1)

- long tasks: 52 ms

### `/docs/api` at 390 (score 1)

- long tasks: 51 ms

### `/docs` at 390 (score 1)

- long tasks: 52 ms

### `/docs/security-model` at 390 (score 1)

- long tasks: 60 ms

### `/docs/adapters/edge` at 390 (score 1)

- long tasks: 59 ms

### `/docs/adapters/sdk` at 390 (score 1)

- long tasks: 57 ms

### `/docs/adapters/shield` at 390 (score 1)

- long tasks: 65 ms

### `/docs/adapters/vault` at 390 (score 1)

- long tasks: 52 ms

### `/docs/adapters/web` at 390 (score 1)

- long tasks: 65 ms

### `/docs/concepts/hybrid-kem` at 390 (score 1)

- long tasks: 61 ms

### `/docs/concepts` at 390 (score 1)

- long tasks: 56 ms

### `/docs/concepts/key-rotation` at 390 (score 1)

- long tasks: 53 ms

### `/docs/concepts/sessions` at 390 (score 1)

- long tasks: 52 ms

### `/docs/concepts/signatures` at 390 (score 1)

- long tasks: 53 ms

### `/join` at 390 (score 1)

- long tasks: 52 ms

### `/pitch` at 390 (score 1)

- long tasks: 80 ms
- layout shift 0.005: div.col-span-12.animate-reveal.space-y-10

### `/scan/www.irctc.co.in` at 390 (score 1)

- long tasks: 53 ms
