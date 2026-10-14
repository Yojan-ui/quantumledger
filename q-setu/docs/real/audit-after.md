# Glitch audit (after)

`pnpm audit:glitch after` against the production build at http://localhost:3000, 2026-10-14T04:11 UTC.
Every page at 1440×900, and at 390×844 with 4× CPU throttling. Each run: load, scroll to the end, the
page's main action (Play, Verify, Tamper, Scan… or hover across it), 10 s in all. Videos are in
`docs/real/videos-after/` (not committed).

## Totals

|                                  | 1440  | 390 (4× CPU) |
| -------------------------------- | ----- | ------------ |
| Console errors + page errors     | 1     | 2            |
| Console warnings                 | 0     | 0            |
| Hydration warnings               | 0     | 0            |
| WebGL driver messages            | 0     | 0            |
| WebGL contexts lost              | 0     | 0            |
| Long tasks > 50 ms               | 15    | 80           |
| Worst frame while scrolling (ms) | 33    | 250          |
| Worst frame in a transition (ms) | 34    | 300          |
| Worst page CLS                   | 0.019 | 0.0238       |
| Failed requests                  | 1     | 2            |

## Ranked (worst first)

| #   | Page                          | Width | Score | Errors | Hydration | Lost | Long tasks  | Scroll worst / p95 (ms) | Transition worst / p95 (ms) | CLS    | Failed |
| --- | ----------------------------- | ----- | ----- | ------ | --------- | ---- | ----------- | ----------------------- | --------------------------- | ------ | ------ |
| 1   | `/docs/adapters/shield`       | 390   | 51    | 0      | 0         | 0    | 1 (max 53)  | 17 / 16.7               | 300 / 16.8                  | 0      | 0      |
| 2   | `/scan/www.irctc.co.in`       | 390   | 40    | 0      | 0         | 0    | 0           | 250 / 16.8              | 17 / 16.8                   | 0      | 0      |
| 3   | `/changelog`                  | 390   | 38    | 0      | 0         | 0    | 1 (max 56)  | 233 / 16.7              | 17 / 16.7                   | 0      | 0      |
| 4   | `/docs/concepts/key-rotation` | 390   | 31    | 0      | 0         | 0    | 1 (max 56)  | 200 / 16.7              | 17 / 16.8                   | 0      | 0      |
| 5   | `/about`                      | 390   | 28    | 1      | 0         | 0    | 3 (max 204) | 17 / 16.8               | 17 / 16.8                   | 0      | 1      |
| 6   | `/this-page-does-not-exist`   | 390   | 26    | 1      | 0         | 0    | 1 (max 55)  | 17 / 16.7               | 17 / 16.8                   | 0      | 1      |
| 7   | `/this-page-does-not-exist`   | 1440  | 25    | 1      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 1      |
| 8   | `/docs/api`                   | 390   | 17    | 0      | 0         | 0    | 4 (max 467) | 17 / 16.8               | 117 / 16.8                  | 0      | 0      |
| 9   | `/terms`                      | 390   | 6     | 0      | 0         | 0    | 6 (max 323) | 17 / 16.7               | 50 / 16.8                   | 0      | 0      |
| 10  | `/privacy`                    | 390   | 5     | 0      | 0         | 0    | 5 (max 324) | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 11  | `/`                           | 390   | 4     | 0      | 0         | 0    | 4 (max 208) | 33 / 16.7               | 17 / 16.7                   | 0.0059 | 0      |
| 12  | `/diagnostics`                | 390   | 4     | 0      | 0         | 0    | 4 (max 213) | 17 / 16.7               | 17 / 16.8                   | 0.0236 | 0      |
| 13  | `/platform`                   | 390   | 3     | 0      | 0         | 0    | 3 (max 201) | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 14  | `/solutions`                  | 390   | 3     | 0      | 0         | 0    | 3 (max 198) | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 15  | `/solutions/fintech`          | 390   | 3     | 0      | 0         | 0    | 3 (max 201) | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 16  | `/solutions/healthcare`       | 390   | 3     | 0      | 0         | 0    | 3 (max 198) | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 17  | `/solutions/education`        | 390   | 3     | 0      | 0         | 0    | 3 (max 200) | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 18  | `/solutions/government`       | 390   | 3     | 0      | 0         | 0    | 3 (max 205) | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 19  | `/index`                      | 390   | 3     | 0      | 0         | 0    | 3 (max 206) | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 20  | `/demo/how-it-works`          | 390   | 3     | 0      | 0         | 0    | 3 (max 213) | 17 / 16.8               | 17 / 16.7                   | 0.0059 | 0      |
| 21  | `/demo/deploy`                | 390   | 3     | 0      | 0         | 0    | 3 (max 200) | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 22  | `/demo/qday`                  | 390   | 3     | 0      | 0         | 0    | 3 (max 211) | 17 / 16.8               | 17 / 16.8                   | 0.0158 | 0      |
| 23  | `/demo/ledger`                | 390   | 3     | 0      | 0         | 0    | 3 (max 209) | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 24  | `/`                           | 1440  | 1     | 0      | 0         | 0    | 1 (max 90)  | 17 / 16.8               | 17 / 16.7                   | 0.0033 | 0      |
| 25  | `/platform`                   | 1440  | 1     | 0      | 0         | 0    | 1 (max 73)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 26  | `/solutions`                  | 1440  | 1     | 0      | 0         | 0    | 1 (max 71)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 27  | `/solutions/fintech`          | 1440  | 1     | 0      | 0         | 0    | 1 (max 88)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 28  | `/solutions/healthcare`       | 1440  | 1     | 0      | 0         | 0    | 1 (max 74)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 29  | `/solutions/education`        | 1440  | 1     | 0      | 0         | 0    | 1 (max 75)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 30  | `/solutions/government`       | 1440  | 1     | 0      | 0         | 0    | 1 (max 73)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 31  | `/diagnostics`                | 1440  | 1     | 0      | 0         | 0    | 1 (max 79)  | 17 / 16.7               | 17 / 16.7                   | 0.0043 | 0      |
| 32  | `/index`                      | 1440  | 1     | 0      | 0         | 0    | 1 (max 75)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 33  | `/demo/how-it-works`          | 1440  | 1     | 0      | 0         | 0    | 1 (max 79)  | 17 / 16.8               | 17 / 16.7                   | 0.008  | 0      |
| 34  | `/demo/deploy`                | 1440  | 1     | 0      | 0         | 0    | 1 (max 76)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 35  | `/demo/qday`                  | 1440  | 1     | 0      | 0         | 0    | 1 (max 79)  | 17 / 16.7               | 17 / 16.8                   | 0.019  | 0      |
| 36  | `/demo/ledger`                | 1440  | 1     | 0      | 0         | 0    | 1 (max 86)  | 17 / 16.7               | 17 / 16.7                   | 0.0009 | 0      |
| 37  | `/about`                      | 1440  | 1     | 0      | 0         | 0    | 1 (max 73)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 38  | `/pitch`                      | 1440  | 1     | 0      | 0         | 0    | 1 (max 78)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 39  | `/demos`                      | 390   | 1     | 0      | 0         | 0    | 1 (max 55)  | 17 / 16.7               | 33 / 33.4                   | 0      | 0      |
| 40  | `/demo/scanner`               | 390   | 1     | 0      | 0         | 0    | 1 (max 54)  | 17 / 16.8               | 17 / 16.7                   | 0.0238 | 0      |
| 41  | `/pricing`                    | 390   | 1     | 0      | 0         | 0    | 1 (max 58)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 42  | `/security`                   | 390   | 1     | 0      | 0         | 0    | 1 (max 56)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 43  | `/contact`                    | 390   | 1     | 0      | 0         | 0    | 1 (max 56)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 44  | `/docs`                       | 390   | 1     | 0      | 0         | 0    | 1 (max 59)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 45  | `/docs/security-model`        | 390   | 1     | 0      | 0         | 0    | 1 (max 55)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 46  | `/docs/adapters/edge`         | 390   | 1     | 0      | 0         | 0    | 1 (max 55)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 47  | `/docs/adapters/sdk`          | 390   | 1     | 0      | 0         | 0    | 1 (max 55)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 48  | `/docs/adapters/vault`        | 390   | 1     | 0      | 0         | 0    | 1 (max 80)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 49  | `/docs/adapters/web`          | 390   | 1     | 0      | 0         | 0    | 1 (max 88)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 50  | `/docs/concepts/hybrid-kem`   | 390   | 1     | 0      | 0         | 0    | 1 (max 55)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 51  | `/docs/concepts`              | 390   | 1     | 0      | 0         | 0    | 1 (max 55)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 52  | `/docs/concepts/sessions`     | 390   | 1     | 0      | 0         | 0    | 1 (max 58)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 53  | `/docs/concepts/signatures`   | 390   | 1     | 0      | 0         | 0    | 1 (max 57)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 54  | `/join`                       | 390   | 1     | 0      | 0         | 0    | 1 (max 56)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 55  | `/pitch`                      | 390   | 1     | 0      | 0         | 0    | 1 (max 56)  | 17 / 16.7               | 17 / 16.7                   | 0.0083 | 0      |
| 56  | `/demos`                      | 1440  | 0     | 0      | 0         | 0    | 0           | 33 / 16.8               | 34 / 33.4                   | 0      | 0      |
| 57  | `/demo/scanner`               | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0.0008 | 0      |
| 58  | `/pricing`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 59  | `/security`                   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 60  | `/changelog`                  | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 61  | `/contact`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 62  | `/privacy`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 63  | `/terms`                      | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 64  | `/docs/api`                   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 65  | `/docs`                       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 66  | `/docs/security-model`        | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 67  | `/docs/adapters/edge`         | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 68  | `/docs/adapters/sdk`          | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 69  | `/docs/adapters/shield`       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 70  | `/docs/adapters/vault`        | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 71  | `/docs/adapters/web`          | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 72  | `/docs/concepts/hybrid-kem`   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 73  | `/docs/concepts`              | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 74  | `/docs/concepts/key-rotation` | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 75  | `/docs/concepts/sessions`     | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 76  | `/docs/concepts/signatures`   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 77  | `/join`                       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0.0132 | 0      |
| 78  | `/scan/www.irctc.co.in`       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |

## Details

### `/docs/adapters/shield` at 390 (score 51)

- long tasks: 53 ms

### `/scan/www.irctc.co.in` at 390 (score 40)

### `/changelog` at 390 (score 38)

- long tasks: 56 ms

### `/docs/concepts/key-rotation` at 390 (score 31)

- long tasks: 56 ms

### `/about` at 390 (score 28)

- console error: Failed to load resource: net::ERR_NETWORK_IO_SUSPENDED
- long tasks: 76, 87, 204 ms
- failed: /api/stream (net::ERR_NETWORK_IO_SUSPENDED)

### `/this-page-does-not-exist` at 390 (score 26)

- console error: Failed to load resource: the server responded with a status of 404 (Not Found)
- long tasks: 55 ms
- failed: /this-page-does-not-exist (HTTP 404)

### `/this-page-does-not-exist` at 1440 (score 25)

- console error: Failed to load resource: the server responded with a status of 404 (Not Found)
- failed: /this-page-does-not-exist (HTTP 404)

### `/docs/api` at 390 (score 17)

- long tasks: 124, 467, 68, 131 ms

### `/terms` at 390 (score 6)

- long tasks: 96, 323, 164, 65, 128, 53 ms

### `/privacy` at 390 (score 5)

- long tasks: 108, 324, 164, 64, 129 ms

### `/` at 390 (score 4)

- long tasks: 110, 57, 71, 208 ms
- layout shift 0.0054: div.absolute.right-5.top-6

### `/diagnostics` at 390 (score 4)

- long tasks: 56, 72, 213, 86 ms
- layout shift 0.0077: div.absolute.bottom-3.left-3, dd.min-w-0.truncate.text-right
- layout shift 0.0076: button.h-8.rounded-sm.border, (text), dd.min-w-0.truncate.text-right
- layout shift 0.005: button.h-8.rounded-sm.border, button.h-8.rounded-sm.border, dd.min-w-0.truncate.text-right, (text), dd.min-w-0.truncate.text-right
- layout shift 0.0019: dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, (text), dd.min-w-0.truncate.text-right
- layout shift 0.0013: div.absolute.bottom-3.left-3

### `/platform` at 390 (score 3)

- long tasks: 56, 83, 201 ms

### `/solutions` at 390 (score 3)

- long tasks: 55, 84, 198 ms

### `/solutions/fintech` at 390 (score 3)

- long tasks: 56, 84, 201 ms

### `/solutions/healthcare` at 390 (score 3)

- long tasks: 57, 87, 198 ms

### `/solutions/education` at 390 (score 3)

- long tasks: 56, 84, 200 ms

### `/solutions/government` at 390 (score 3)

- long tasks: 56, 84, 205 ms

### `/index` at 390 (score 3)

- long tasks: 57, 85, 206 ms

### `/demo/how-it-works` at 390 (score 3)

- long tasks: 55, 71, 213 ms
- layout shift 0.0059: div.pointer-events-none.absolute.inset-x-0

### `/demo/deploy` at 390 (score 3)

- long tasks: 57, 86, 200 ms

### `/demo/qday` at 390 (score 3)

- long tasks: 56, 72, 211 ms
- layout shift 0.0096: li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3
- layout shift 0.0059: div.pointer-events-none.absolute.inset-x-0

### `/demo/ledger` at 390 (score 3)

- long tasks: 57, 70, 209 ms

### `/` at 1440 (score 1)

- long tasks: 90 ms
- layout shift 0.0023: div.mt-8

### `/platform` at 1440 (score 1)

- long tasks: 73 ms

### `/solutions` at 1440 (score 1)

- long tasks: 71 ms

### `/solutions/fintech` at 1440 (score 1)

- long tasks: 88 ms

### `/solutions/healthcare` at 1440 (score 1)

- long tasks: 74 ms

### `/solutions/education` at 1440 (score 1)

- long tasks: 75 ms

### `/solutions/government` at 1440 (score 1)

- long tasks: 73 ms

### `/diagnostics` at 1440 (score 1)

- long tasks: 79 ms
- layout shift 0.0017: p.text-fg-2, button.hidden.h-8.rounded-sm, button.h-8.rounded-sm.border, (text), dd.min-w-0.truncate.text-right

### `/index` at 1440 (score 1)

- long tasks: 75 ms

### `/demo/how-it-works` at 1440 (score 1)

- long tasks: 79 ms
- layout shift 0.007: div.pointer-events-none.absolute.inset-x-0, div.pr-6.md:border-l.md:border-line, div.pr-6.md:border-l.md:border-line, div.pr-6.md:border-l.md:border-line, div.pr-6.md:border-l.md:border-line

### `/demo/deploy` at 1440 (score 1)

- long tasks: 76 ms

### `/demo/qday` at 1440 (score 1)

- long tasks: 79 ms
- layout shift 0.0122: div.pointer-events-none.absolute.inset-x-0
- layout shift 0.003: li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3

### `/demo/ledger` at 1440 (score 1)

- long tasks: 86 ms

### `/about` at 1440 (score 1)

- long tasks: 73 ms

### `/pitch` at 1440 (score 1)

- long tasks: 78 ms

### `/demos` at 390 (score 1)

- long tasks: 55 ms

### `/demo/scanner` at 390 (score 1)

- long tasks: 54 ms
- layout shift 0.0238: textarea#scan-input.h-stage-sm.w-full.resize-y, div.inline-flex.flex-wrap.rounded-sm

### `/pricing` at 390 (score 1)

- long tasks: 58 ms

### `/security` at 390 (score 1)

- long tasks: 56 ms

### `/contact` at 390 (score 1)

- long tasks: 56 ms

### `/docs` at 390 (score 1)

- long tasks: 59 ms

### `/docs/security-model` at 390 (score 1)

- long tasks: 55 ms

### `/docs/adapters/edge` at 390 (score 1)

- long tasks: 55 ms

### `/docs/adapters/sdk` at 390 (score 1)

- long tasks: 55 ms

### `/docs/adapters/vault` at 390 (score 1)

- long tasks: 80 ms

### `/docs/adapters/web` at 390 (score 1)

- long tasks: 88 ms

### `/docs/concepts/hybrid-kem` at 390 (score 1)

- long tasks: 55 ms

### `/docs/concepts` at 390 (score 1)

- long tasks: 55 ms

### `/docs/concepts/sessions` at 390 (score 1)

- long tasks: 58 ms

### `/docs/concepts/signatures` at 390 (score 1)

- long tasks: 57 ms

### `/join` at 390 (score 1)

- long tasks: 56 ms

### `/pitch` at 390 (score 1)

- long tasks: 56 ms
- layout shift 0.0083: div.col-span-12.animate-reveal.space-y-10
