# Glitch audit (before)

`AUDIT_OUT=docs/real pnpm audit:glitch before` against the production build at http://localhost:3000, 2026-10-13T22:34 UTC.
Every page at 1440×900, and at 390×844 with 4× CPU throttling. Each run: load, scroll to the end, the
page's main action (Play, Verify, Tamper, Scan… or hover across it), 10 s in all. Videos are in
`docs/real/videos-before/` (not committed).

## Totals

| | 1440 | 390 (4× CPU) |
| --- | --- | --- |
| Console errors + page errors | 3 | 1 |
| Console warnings | 0 | 0 |
| Hydration warnings | 0 | 0 |
| WebGL driver messages | 0 | 0 |
| WebGL contexts lost | 0 | 0 |
| Long tasks > 50 ms | 46 | 204 |
| Worst frame while scrolling (ms) | 100 | 317 |
| Worst frame in a transition (ms) | 34 | 717 |
| Worst page CLS | 0.019 | 0.0238 |
| Failed requests | 2 | 1 |

## Ranked (worst first)

| # | Page | Width | Score | Errors | Hydration | Lost | Long tasks | Scroll worst / p95 (ms) | Transition worst / p95 (ms) | CLS | Failed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `/platform` | 390 | 142 | 0 | 0 | 0 | 9 (max 585) | 17 / 16.7 | 717 / 16.8 | 0 | 0 |
| 2 | `/demo/ledger` | 390 | 121 | 0 | 0 | 0 | 8 (max 546) | 83 / 16.8 | 583 / 16.8 | 0 | 0 |
| 3 | `/demo/qday` | 390 | 112 | 0 | 0 | 0 | 9 (max 539) | 17 / 16.8 | 567 / 16.8 | 0.0157 | 0 |
| 4 | `/demo/scanner` | 1440 | 65 | 2 | 0 | 0 | 0 | 17 / 16.8 | 33 / 16.7 | 0.0008 | 1 |
| 5 | `/diagnostics` | 390 | 62 | 0 | 0 | 0 | 9 (max 594) | 317 / 16.8 | 50 / 16.8 | 0.0179 | 0 |
| 6 | `/` | 390 | 40 | 0 | 0 | 0 | 13 (max 565) | 167 / 33.3 | 67 / 16.8 | 0.0059 | 0 |
| 7 | `/this-page-does-not-exist` | 390 | 29 | 1 | 0 | 0 | 4 (max 174) | 17 / 16.8 | 33 / 16.8 | 0 | 1 |
| 8 | `/this-page-does-not-exist` | 1440 | 27 | 1 | 0 | 0 | 2 (max 57) | 17 / 16.7 | 33 / 16.7 | 0 | 1 |
| 9 | `/` | 1440 | 18 | 0 | 0 | 0 | 8 (max 374) | 100 / 16.8 | 33 / 16.8 | 0.0032 | 0 |
| 10 | `/demo/how-it-works` | 390 | 16 | 0 | 0 | 0 | 9 (max 559) | 67 / 16.8 | 67 / 16.8 | 0.0059 | 0 |
| 11 | `/solutions/healthcare` | 390 | 11 | 0 | 0 | 0 | 8 (max 599) | 67 / 16.8 | 33 / 16.7 | 0 | 0 |
| 12 | `/solutions/fintech` | 390 | 8 | 0 | 0 | 0 | 8 (max 570) | 33 / 16.8 | 50 / 16.8 | 0 | 0 |
| 13 | `/solutions/government` | 390 | 8 | 0 | 0 | 0 | 8 (max 529) | 50 / 16.7 | 17 / 16.8 | 0 | 0 |
| 14 | `/index` | 390 | 8 | 0 | 0 | 0 | 8 (max 516) | 33 / 16.8 | 33 / 16.7 | 0 | 0 |
| 15 | `/demo/deploy` | 390 | 8 | 0 | 0 | 0 | 8 (max 511) | 33 / 16.7 | 50 / 16.8 | 0 | 0 |
| 16 | `/solutions` | 390 | 6 | 0 | 0 | 0 | 6 (max 533) | 33 / 16.7 | 17 / 16.7 | 0 | 0 |
| 17 | `/solutions/education` | 390 | 6 | 0 | 0 | 0 | 6 (max 528) | 33 / 16.7 | 50 / 16.7 | 0 | 0 |
| 18 | `/about` | 390 | 6 | 0 | 0 | 0 | 6 (max 515) | 34 / 16.8 | 33 / 16.8 | 0 | 0 |
| 19 | `/join` | 390 | 5 | 0 | 0 | 0 | 5 (max 111) | 17 / 16.8 | 17 / 16.8 | 0 | 0 |
| 20 | `/demos` | 390 | 4 | 0 | 0 | 0 | 4 (max 151) | 33 / 16.8 | 34 / 33.4 | 0 | 0 |
| 21 | `/pricing` | 390 | 4 | 0 | 0 | 0 | 4 (max 155) | 17 / 16.7 | 33 / 16.8 | 0 | 0 |
| 22 | `/security` | 390 | 4 | 0 | 0 | 0 | 4 (max 152) | 17 / 16.7 | 33 / 16.8 | 0 | 0 |
| 23 | `/changelog` | 390 | 4 | 0 | 0 | 0 | 4 (max 285) | 17 / 16.8 | 33 / 16.8 | 0 | 0 |
| 24 | `/contact` | 390 | 4 | 0 | 0 | 0 | 4 (max 145) | 17 / 16.7 | 17 / 16.7 | 0 | 0 |
| 25 | `/privacy` | 390 | 4 | 0 | 0 | 0 | 4 (max 143) | 17 / 16.7 | 33 / 16.8 | 0 | 0 |
| 26 | `/terms` | 390 | 4 | 0 | 0 | 0 | 4 (max 150) | 17 / 16.7 | 33 / 16.8 | 0 | 0 |
| 27 | `/docs/api` | 390 | 4 | 0 | 0 | 0 | 4 (max 144) | 17 / 16.8 | 33 / 16.8 | 0 | 0 |
| 28 | `/docs/security-model` | 390 | 4 | 0 | 0 | 0 | 4 (max 149) | 17 / 16.8 | 17 / 16.7 | 0 | 0 |
| 29 | `/docs/adapters/edge` | 390 | 4 | 0 | 0 | 0 | 4 (max 146) | 17 / 16.7 | 17 / 16.7 | 0 | 0 |
| 30 | `/docs/adapters/shield` | 390 | 4 | 0 | 0 | 0 | 4 (max 158) | 17 / 16.7 | 17 / 16.8 | 0 | 0 |
| 31 | `/docs/adapters/vault` | 390 | 4 | 0 | 0 | 0 | 4 (max 150) | 17 / 16.7 | 33 / 16.8 | 0 | 0 |
| 32 | `/docs/concepts/hybrid-kem` | 390 | 4 | 0 | 0 | 0 | 4 (max 159) | 17 / 16.8 | 33 / 16.8 | 0 | 0 |
| 33 | `/pitch` | 390 | 4 | 0 | 0 | 0 | 4 (max 132) | 17 / 16.7 | 17 / 16.7 | 0.0083 | 0 |
| 34 | `/scan/www.irctc.co.in` | 390 | 4 | 0 | 0 | 0 | 4 (max 154) | 17 / 16.8 | 33 / 16.8 | 0.0001 | 0 |
| 35 | `/solutions/fintech` | 1440 | 3 | 0 | 0 | 0 | 3 (max 216) | 17 / 16.8 | 17 / 16.8 | 0 | 0 |
| 36 | `/solutions/government` | 1440 | 3 | 0 | 0 | 0 | 3 (max 234) | 17 / 16.7 | 17 / 16.7 | 0 | 0 |
| 37 | `/diagnostics` | 1440 | 3 | 0 | 0 | 0 | 3 (max 223) | 17 / 16.8 | 17 / 16.8 | 0.0036 | 0 |
| 38 | `/pitch` | 1440 | 3 | 0 | 0 | 0 | 3 (max 237) | 17 / 16.7 | 33 / 16.8 | 0 | 0 |
| 39 | `/demo/scanner` | 390 | 3 | 0 | 0 | 0 | 3 (max 145) | 17 / 16.7 | 50 / 16.8 | 0.0238 | 0 |
| 40 | `/docs` | 390 | 3 | 0 | 0 | 0 | 3 (max 146) | 17 / 16.7 | 33 / 16.8 | 0 | 0 |
| 41 | `/docs/adapters/sdk` | 390 | 3 | 0 | 0 | 0 | 3 (max 148) | 17 / 16.7 | 33 / 16.7 | 0 | 0 |
| 42 | `/docs/adapters/web` | 390 | 3 | 0 | 0 | 0 | 3 (max 153) | 17 / 16.7 | 33 / 16.8 | 0 | 0 |
| 43 | `/docs/concepts` | 390 | 3 | 0 | 0 | 0 | 3 (max 153) | 17 / 16.7 | 17 / 16.7 | 0 | 0 |
| 44 | `/solutions` | 1440 | 2 | 0 | 0 | 0 | 2 (max 207) | 17 / 16.8 | 17 / 16.7 | 0 | 0 |
| 45 | `/solutions/healthcare` | 1440 | 2 | 0 | 0 | 0 | 2 (max 206) | 17 / 16.7 | 17 / 16.7 | 0 | 0 |
| 46 | `/solutions/education` | 1440 | 2 | 0 | 0 | 0 | 2 (max 203) | 17 / 16.7 | 17 / 16.8 | 0 | 0 |
| 47 | `/index` | 1440 | 2 | 0 | 0 | 0 | 2 (max 191) | 33 / 16.7 | 17 / 16.8 | 0 | 0 |
| 48 | `/demo/ledger` | 1440 | 2 | 0 | 0 | 0 | 2 (max 214) | 17 / 16.7 | 17 / 16.7 | 0.0013 | 0 |
| 49 | `/about` | 1440 | 2 | 0 | 0 | 0 | 2 (max 219) | 17 / 16.7 | 17 / 16.7 | 0 | 0 |
| 50 | `/docs/concepts/key-rotation` | 390 | 2 | 0 | 0 | 0 | 2 (max 111) | 17 / 16.8 | 33 / 16.8 | 0 | 0 |
| 51 | `/docs/concepts/sessions` | 390 | 2 | 0 | 0 | 0 | 2 (max 101) | 17 / 16.7 | 33 / 16.8 | 0 | 0 |
| 52 | `/platform` | 1440 | 1 | 0 | 0 | 0 | 1 (max 197) | 17 / 16.7 | 33 / 16.7 | 0 | 0 |
| 53 | `/demo/how-it-works` | 1440 | 1 | 0 | 0 | 0 | 1 (max 218) | 17 / 16.7 | 17 / 16.7 | 0.0077 | 0 |
| 54 | `/demo/deploy` | 1440 | 1 | 0 | 0 | 0 | 1 (max 212) | 17 / 16.7 | 17 / 16.8 | 0 | 0 |
| 55 | `/demo/qday` | 1440 | 1 | 0 | 0 | 0 | 1 (max 213) | 33 / 16.8 | 17 / 16.7 | 0.019 | 0 |
| 56 | `/changelog` | 1440 | 1 | 0 | 0 | 0 | 1 (max 59) | 17 / 16.8 | 33 / 16.7 | 0 | 0 |
| 57 | `/privacy` | 1440 | 1 | 0 | 0 | 0 | 1 (max 53) | 17 / 16.7 | 17 / 16.8 | 0 | 0 |
| 58 | `/docs/adapters/edge` | 1440 | 1 | 0 | 0 | 0 | 1 (max 55) | 17 / 16.7 | 17 / 16.7 | 0 | 0 |
| 59 | `/docs/adapters/shield` | 1440 | 1 | 0 | 0 | 0 | 1 (max 53) | 17 / 16.7 | 17 / 16.7 | 0 | 0 |
| 60 | `/docs/adapters/vault` | 1440 | 1 | 0 | 0 | 0 | 1 (max 53) | 17 / 16.7 | 17 / 16.7 | 0 | 0 |
| 61 | `/docs/concepts/signatures` | 1440 | 1 | 0 | 0 | 0 | 1 (max 80) | 17 / 16.7 | 17 / 16.7 | 0 | 0 |
| 62 | `/join` | 1440 | 1 | 0 | 0 | 0 | 1 (max 63) | 17 / 16.7 | 17 / 16.8 | 0.0132 | 0 |
| 63 | `/scan/www.irctc.co.in` | 1440 | 1 | 0 | 0 | 0 | 1 (max 75) | 17 / 16.8 | 17 / 16.8 | 0 | 0 |
| 64 | `/docs/concepts/signatures` | 390 | 1 | 0 | 0 | 0 | 1 (max 114) | 17 / 16.7 | 33 / 16.8 | 0 | 0 |
| 65 | `/demos` | 1440 | 0 | 0 | 0 | 0 | 0 | 33 / 16.8 | 34 / 33.4 | 0 | 0 |
| 66 | `/pricing` | 1440 | 0 | 0 | 0 | 0 | 0 | 17 / 16.7 | 17 / 16.7 | 0 | 0 |
| 67 | `/security` | 1440 | 0 | 0 | 0 | 0 | 0 | 17 / 16.8 | 17 / 16.7 | 0 | 0 |
| 68 | `/contact` | 1440 | 0 | 0 | 0 | 0 | 0 | 17 / 16.7 | 17 / 16.8 | 0 | 0 |
| 69 | `/terms` | 1440 | 0 | 0 | 0 | 0 | 0 | 17 / 16.7 | 17 / 16.7 | 0 | 0 |
| 70 | `/docs/api` | 1440 | 0 | 0 | 0 | 0 | 0 | 17 / 16.7 | 17 / 16.8 | 0 | 0 |
| 71 | `/docs` | 1440 | 0 | 0 | 0 | 0 | 0 | 17 / 16.7 | 17 / 16.7 | 0 | 0 |
| 72 | `/docs/security-model` | 1440 | 0 | 0 | 0 | 0 | 0 | 17 / 16.8 | 17 / 16.7 | 0 | 0 |
| 73 | `/docs/adapters/sdk` | 1440 | 0 | 0 | 0 | 0 | 0 | 17 / 16.7 | 17 / 16.7 | 0 | 0 |
| 74 | `/docs/adapters/web` | 1440 | 0 | 0 | 0 | 0 | 0 | 17 / 16.7 | 17 / 16.8 | 0 | 0 |
| 75 | `/docs/concepts/hybrid-kem` | 1440 | 0 | 0 | 0 | 0 | 0 | 17 / 16.8 | 17 / 16.8 | 0 | 0 |
| 76 | `/docs/concepts` | 1440 | 0 | 0 | 0 | 0 | 0 | 17 / 16.7 | 17 / 16.8 | 0 | 0 |
| 77 | `/docs/concepts/key-rotation` | 1440 | 0 | 0 | 0 | 0 | 0 | 17 / 16.7 | 17 / 16.7 | 0 | 0 |
| 78 | `/docs/concepts/sessions` | 1440 | 0 | 0 | 0 | 0 | 0 | 17 / 16.7 | 17 / 16.8 | 0 | 0 |

## Details

### `/platform` at 390 (score 142)

- long tasks: 131, 161, 74, 91, 62, 69, 220, 585, 149 ms

### `/demo/ledger` at 390 (score 121)

- long tasks: 138, 86, 62, 188, 67, 546, 156, 91 ms

### `/demo/qday` at 390 (score 112)

- long tasks: 182, 77, 76, 51, 183, 65, 539, 159, 92 ms
- layout shift 0.0096: li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3
- layout shift 0.0059: div.pointer-events-none.absolute.inset-x-0

### `/demo/scanner` at 1440 (score 65)

- page error: TypeError: Cannot read properties of undefined (reading 'length')
- console error: Failed to load resource: the server responded with a status of 429 (Too Many Requests)
- failed: /api/plan (HTTP 429)

### `/diagnostics` at 390 (score 62)

- long tasks: 102, 223, 82, 192, 63, 594, 230, 86, 66 ms
- layout shift 0.0077: div.absolute.bottom-3.left-3, dd.min-w-0.truncate.text-right
- layout shift 0.0039: button.h-8.rounded-sm.border, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, (text)
- layout shift 0.0027: dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, (text)
- layout shift 0.0021: dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, (text)
- layout shift 0.0013: div.absolute.bottom-3.left-3

### `/` at 390 (score 40)

- long tasks: 180, 254, 136, 83, 58, 105, 165, 59, 565, 193, 83, 104, 58 ms
- layout shift 0.0054: div.absolute.right-5.top-6

### `/this-page-does-not-exist` at 390 (score 29)

- console error: Failed to load resource: the server responded with a status of 404 (Not Found)
- long tasks: 70, 174, 73, 65 ms
- failed: /this-page-does-not-exist (HTTP 404)

### `/this-page-does-not-exist` at 1440 (score 27)

- console error: Failed to load resource: the server responded with a status of 404 (Not Found)
- long tasks: 57, 56 ms
- failed: /this-page-does-not-exist (HTTP 404)

### `/` at 1440 (score 18)

- long tasks: 138, 63, 58, 67, 374, 67, 81, 73 ms
- layout shift 0.0023: div.mt-8

### `/demo/how-it-works` at 390 (score 16)

- long tasks: 149, 74, 74, 61, 83, 198, 64, 559, 59 ms
- layout shift 0.0059: div.pointer-events-none.absolute.inset-x-0

### `/solutions/healthcare` at 390 (score 11)

- long tasks: 87, 191, 87, 81, 246, 599, 123, 79 ms

### `/solutions/fintech` at 390 (score 8)

- long tasks: 54, 187, 60, 63, 296, 570, 139, 57 ms

### `/solutions/government` at 390 (score 8)

- long tasks: 54, 136, 56, 59, 215, 529, 127, 64 ms

### `/index` at 390 (score 8)

- long tasks: 86, 142, 78, 64, 68, 230, 516, 81 ms

### `/demo/deploy` at 390 (score 8)

- long tasks: 95, 153, 110, 68, 62, 226, 511, 72 ms

### `/solutions` at 390 (score 6)

- long tasks: 137, 117, 59, 221, 533, 125 ms

### `/solutions/education` at 390 (score 6)

- long tasks: 150, 145, 72, 221, 528, 115 ms

### `/about` at 390 (score 6)

- long tasks: 150, 58, 64, 222, 515, 106 ms

### `/join` at 390 (score 5)

- long tasks: 71, 111, 60, 51, 51 ms

### `/demos` at 390 (score 4)

- long tasks: 55, 151, 58, 67 ms

### `/pricing` at 390 (score 4)

- long tasks: 53, 155, 56, 60 ms

### `/security` at 390 (score 4)

- long tasks: 63, 152, 60, 60 ms

### `/changelog` at 390 (score 4)

- long tasks: 108, 285, 80, 67 ms

### `/contact` at 390 (score 4)

- long tasks: 54, 145, 61, 61 ms

### `/privacy` at 390 (score 4)

- long tasks: 53, 143, 76, 63 ms

### `/terms` at 390 (score 4)

- long tasks: 52, 150, 57, 63 ms

### `/docs/api` at 390 (score 4)

- long tasks: 69, 144, 58, 59 ms

### `/docs/security-model` at 390 (score 4)

- long tasks: 65, 149, 78, 65 ms

### `/docs/adapters/edge` at 390 (score 4)

- long tasks: 54, 146, 57, 65 ms

### `/docs/adapters/shield` at 390 (score 4)

- long tasks: 71, 158, 58, 65 ms

### `/docs/adapters/vault` at 390 (score 4)

- long tasks: 66, 150, 91, 63 ms

### `/docs/concepts/hybrid-kem` at 390 (score 4)

- long tasks: 112, 159, 78, 66 ms

### `/pitch` at 390 (score 4)

- long tasks: 132, 64, 52, 63 ms
- layout shift 0.0083: div.col-span-12.animate-reveal.space-y-10

### `/scan/www.irctc.co.in` at 390 (score 4)

- long tasks: 91, 154, 86, 61 ms

### `/solutions/fintech` at 1440 (score 3)

- long tasks: 63, 216, 52 ms

### `/solutions/government` at 1440 (score 3)

- long tasks: 59, 234, 51 ms

### `/diagnostics` at 1440 (score 3)

- long tasks: 52, 223, 82 ms

### `/pitch` at 1440 (score 3)

- long tasks: 56, 237, 103 ms

### `/demo/scanner` at 390 (score 3)

- long tasks: 145, 76, 63 ms
- layout shift 0.0238: textarea#scan-input.h-stage-sm.w-full.resize-y, div.inline-flex.flex-wrap.rounded-sm

### `/docs` at 390 (score 3)

- long tasks: 146, 76, 61 ms

### `/docs/adapters/sdk` at 390 (score 3)

- long tasks: 148, 57, 65 ms

### `/docs/adapters/web` at 390 (score 3)

- long tasks: 153, 61, 64 ms

### `/docs/concepts` at 390 (score 3)

- long tasks: 153, 80, 67 ms

### `/solutions` at 1440 (score 2)

- long tasks: 63, 207 ms

### `/solutions/healthcare` at 1440 (score 2)

- long tasks: 70, 206 ms

### `/solutions/education` at 1440 (score 2)

- long tasks: 65, 203 ms

### `/index` at 1440 (score 2)

- long tasks: 51, 191 ms

### `/demo/ledger` at 1440 (score 2)

- long tasks: 56, 214 ms

### `/about` at 1440 (score 2)

- long tasks: 61, 219 ms

### `/docs/concepts/key-rotation` at 390 (score 2)

- long tasks: 111, 55 ms

### `/docs/concepts/sessions` at 390 (score 2)

- long tasks: 101, 53 ms

### `/platform` at 1440 (score 1)

- long tasks: 197 ms

### `/demo/how-it-works` at 1440 (score 1)

- long tasks: 218 ms
- layout shift 0.0061: div.pointer-events-none.absolute.inset-x-0

### `/demo/deploy` at 1440 (score 1)

- long tasks: 212 ms

### `/demo/qday` at 1440 (score 1)

- long tasks: 213 ms
- layout shift 0.0122: div.pointer-events-none.absolute.inset-x-0
- layout shift 0.003: li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3

### `/changelog` at 1440 (score 1)

- long tasks: 59 ms

### `/privacy` at 1440 (score 1)

- long tasks: 53 ms

### `/docs/adapters/edge` at 1440 (score 1)

- long tasks: 55 ms

### `/docs/adapters/shield` at 1440 (score 1)

- long tasks: 53 ms

### `/docs/adapters/vault` at 1440 (score 1)

- long tasks: 53 ms

### `/docs/concepts/signatures` at 1440 (score 1)

- long tasks: 80 ms

### `/join` at 1440 (score 1)

- long tasks: 63 ms
- layout shift 0.0132: fieldset.mt-8

### `/scan/www.irctc.co.in` at 1440 (score 1)

- long tasks: 75 ms

### `/docs/concepts/signatures` at 390 (score 1)

- long tasks: 114 ms

