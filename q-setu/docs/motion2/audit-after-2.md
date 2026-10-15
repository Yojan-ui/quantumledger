# Glitch audit (after-2)

`pnpm audit:glitch after-2` against the production build at http://localhost:3000, 2026-10-15T15:19 UTC.
Every page at 1440×900, and at 390×844 with 4× CPU throttling. Each run: load, scroll to the end, the
page's main action (Play, Verify, Tamper, Scan… or hover across it), 10 s in all. Videos are in
`docs/motion2/videos-after-2/` (not committed).

## Totals

|                                  | 1440   | 390 (4× CPU) |
| -------------------------------- | ------ | ------------ |
| Console errors + page errors     | 3      | 1            |
| Console warnings                 | 0      | 0            |
| Hydration warnings               | 0      | 0            |
| WebGL driver messages            | 0      | 0            |
| WebGL contexts lost              | 0      | 0            |
| Long tasks > 50 ms               | 16     | 96           |
| Worst frame while scrolling (ms) | 33     | 283          |
| Worst frame in a transition (ms) | 100    | 283          |
| Worst page CLS                   | 0.0217 | 0.0239       |
| Failed requests                  | 834    | 323          |

## Ranked (worst first)

| #   | Page                          | Width | Score | Errors | Hydration | Lost | Long tasks  | Scroll worst / p95 (ms) | Transition worst / p95 (ms) | CLS    | Failed |
| --- | ----------------------------- | ----- | ----- | ------ | --------- | ---- | ----------- | ----------------------- | --------------------------- | ------ | ------ |
| 1   | `/docs/concepts/key-rotation` | 1440  | 320   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 32     |
| 2   | `/docs/security-model`        | 1440  | 290   | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 29     |
| 3   | `/docs/adapters/edge`         | 1440  | 290   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 29     |
| 4   | `/docs/adapters/vault`        | 1440  | 290   | 0      | 0         | 0    | 0           | 17 / 16.7               | 33 / 16.7                   | 0      | 29     |
| 5   | `/docs/concepts/hybrid-kem`   | 1440  | 290   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 29     |
| 6   | `/docs/concepts/sessions`     | 1440  | 290   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 29     |
| 7   | `/docs/concepts/signatures`   | 1440  | 290   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 29     |
| 8   | `/docs/adapters/shield`       | 1440  | 270   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 27     |
| 9   | `/docs/adapters/web`          | 1440  | 270   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 27     |
| 10  | `/docs/concepts`              | 1440  | 270   | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 27     |
| 11  | `/docs/api`                   | 1440  | 260   | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 26     |
| 12  | `/solutions/healthcare`       | 1440  | 251   | 0      | 0         | 0    | 1 (max 97)  | 17 / 16.7               | 17 / 16.7                   | 0      | 25     |
| 13  | `/shield`                     | 1440  | 250   | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 25     |
| 14  | `/shield/live`                | 1440  | 250   | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 25     |
| 15  | `/docs`                       | 1440  | 250   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 25     |
| 16  | `/solutions/education`        | 1440  | 241   | 0      | 0         | 0    | 1 (max 95)  | 17 / 16.7               | 17 / 16.8                   | 0      | 24     |
| 17  | `/index`                      | 1440  | 241   | 0      | 0         | 0    | 1 (max 106) | 17 / 16.7               | 17 / 16.8                   | 0      | 24     |
| 18  | `/security`                   | 1440  | 240   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 24     |
| 19  | `/terms`                      | 1440  | 240   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 24     |
| 20  | `/scan/www.irctc.co.in`       | 1440  | 240   | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 24     |
| 21  | `/this-page-does-not-exist`   | 1440  | 240   | 2      | 0         | 0    | 0           | 17 / 16.8               | 100 / 16.8                  | 0      | 20     |
| 22  | `/solutions/government`       | 1440  | 231   | 0      | 0         | 0    | 1 (max 100) | 17 / 16.7               | 17 / 16.8                   | 0      | 23     |
| 23  | `/docs/adapters/sdk`          | 1440  | 230   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 23     |
| 24  | `/demos`                      | 1440  | 220   | 0      | 0         | 0    | 0           | 33 / 16.7               | 33 / 33.4                   | 0      | 22     |
| 25  | `/changelog`                  | 1440  | 220   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 22     |
| 26  | `/privacy`                    | 1440  | 220   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 22     |
| 27  | `/platform`                   | 1440  | 211   | 0      | 0         | 0    | 1 (max 100) | 17 / 16.7               | 17 / 16.8                   | 0      | 21     |
| 28  | `/docs/concepts/key-rotation` | 390   | 202   | 0      | 0         | 0    | 2 (max 132) | 17 / 16.8               | 17 / 16.8                   | 0      | 20     |
| 29  | `/about`                      | 1440  | 201   | 0      | 0         | 0    | 1 (max 103) | 17 / 16.7               | 17 / 16.7                   | 0      | 20     |
| 30  | `/shield/live`                | 390   | 192   | 0      | 0         | 0    | 2 (max 138) | 250 / 16.7              | 17 / 16.7                   | 0      | 15     |
| 31  | `/docs/concepts`              | 390   | 182   | 0      | 0         | 0    | 2 (max 122) | 17 / 16.8               | 17 / 16.8                   | 0      | 18     |
| 32  | `/solutions/fintech`          | 1440  | 181   | 0      | 0         | 0    | 1 (max 94)  | 17 / 16.8               | 17 / 16.7                   | 0      | 18     |
| 33  | `/pricing`                    | 1440  | 180   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 18     |
| 34  | `/docs/adapters/edge`         | 390   | 172   | 0      | 0         | 0    | 2 (max 122) | 17 / 16.7               | 17 / 16.7                   | 0      | 17     |
| 35  | `/this-page-does-not-exist`   | 390   | 167   | 1      | 0         | 0    | 2 (max 122) | 17 / 16.8               | 17 / 16.8                   | 0      | 15     |
| 36  | `/docs/adapters/vault`        | 390   | 162   | 0      | 0         | 0    | 2 (max 125) | 17 / 16.7               | 17 / 16.7                   | 0      | 16     |
| 37  | `/`                           | 1440  | 161   | 0      | 0         | 0    | 1 (max 110) | 17 / 16.8               | 17 / 16.8                   | 0.0034 | 16     |
| 38  | `/solutions`                  | 1440  | 161   | 0      | 0         | 0    | 1 (max 98)  | 17 / 16.8               | 17 / 16.8                   | 0      | 16     |
| 39  | `/docs`                       | 390   | 152   | 0      | 0         | 0    | 2 (max 126) | 17 / 16.8               | 17 / 16.7                   | 0      | 15     |
| 40  | `/docs/api`                   | 390   | 142   | 0      | 0         | 0    | 2 (max 118) | 17 / 16.8               | 17 / 16.8                   | 0      | 14     |
| 41  | `/docs/adapters/shield`       | 390   | 142   | 0      | 0         | 0    | 2 (max 122) | 17 / 16.7               | 17 / 16.8                   | 0      | 14     |
| 42  | `/contact`                    | 1440  | 140   | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 14     |
| 43  | `/docs/adapters/sdk`          | 390   | 132   | 0      | 0         | 0    | 2 (max 123) | 17 / 16.8               | 17 / 16.8                   | 0      | 13     |
| 44  | `/docs/security-model`        | 390   | 122   | 0      | 0         | 0    | 2 (max 138) | 17 / 16.7               | 17 / 16.8                   | 0      | 12     |
| 45  | `/docs/adapters/web`          | 390   | 122   | 0      | 0         | 0    | 2 (max 120) | 17 / 16.7               | 17 / 16.7                   | 0      | 12     |
| 46  | `/docs/concepts/hybrid-kem`   | 390   | 122   | 0      | 0         | 0    | 2 (max 126) | 17 / 16.8               | 17 / 16.8                   | 0      | 12     |
| 47  | `/docs/concepts/signatures`   | 390   | 122   | 0      | 0         | 0    | 2 (max 121) | 17 / 16.8               | 17 / 16.7                   | 0      | 12     |
| 48  | `/docs/concepts/sessions`     | 390   | 112   | 0      | 0         | 0    | 2 (max 120) | 17 / 16.8               | 17 / 16.8                   | 0      | 11     |
| 49  | `/scan/www.irctc.co.in`       | 390   | 102   | 0      | 0         | 0    | 2 (max 120) | 17 / 16.7               | 17 / 16.8                   | 0      | 10     |
| 50  | `/contact`                    | 390   | 92    | 0      | 0         | 0    | 2 (max 117) | 17 / 16.7               | 17 / 16.8                   | 0      | 9      |
| 51  | `/join`                       | 1440  | 86    | 1      | 0         | 0    | 1 (max 55)  | 17 / 16.7               | 50 / 16.7                   | 0.0132 | 7      |
| 52  | `/`                           | 390   | 83    | 0      | 0         | 0    | 6 (max 195) | 283 / 16.8              | 17 / 16.8                   | 0.0055 | 3      |
| 53  | `/platform`                   | 390   | 79    | 0      | 0         | 0    | 2 (max 403) | 17 / 16.7               | 283 / 16.8                  | 0      | 3      |
| 54  | `/shield`                     | 390   | 72    | 0      | 0         | 0    | 2 (max 108) | 17 / 16.7               | 17 / 16.7                   | 0      | 7      |
| 55  | `/diagnostics`                | 1440  | 71    | 0      | 0         | 0    | 1 (max 80)  | 17 / 16.7               | 17 / 16.7                   | 0.0039 | 7      |
| 56  | `/demo/scanner`               | 1440  | 70    | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0.0008 | 7      |
| 57  | `/solutions`                  | 390   | 63    | 0      | 0         | 0    | 3 (max 202) | 17 / 16.7               | 17 / 16.8                   | 0      | 6      |
| 58  | `/solutions/government`       | 390   | 63    | 0      | 0         | 0    | 3 (max 185) | 17 / 16.8               | 17 / 16.8                   | 0      | 6      |
| 59  | `/pricing`                    | 390   | 62    | 0      | 0         | 0    | 2 (max 114) | 17 / 16.8               | 17 / 16.8                   | 0      | 6      |
| 60  | `/demo/deploy`                | 1440  | 61    | 0      | 0         | 0    | 1 (max 80)  | 17 / 16.8               | 17 / 16.7                   | 0.0007 | 6      |
| 61  | `/demo/ledger`                | 1440  | 61    | 0      | 0         | 0    | 1 (max 81)  | 17 / 16.7               | 17 / 16.8                   | 0.0077 | 6      |
| 62  | `/index`                      | 390   | 53    | 0      | 0         | 0    | 3 (max 189) | 17 / 16.7               | 17 / 16.8                   | 0      | 5      |
| 63  | `/demo/how-it-works`          | 1440  | 51    | 0      | 0         | 0    | 1 (max 81)  | 17 / 16.7               | 17 / 16.7                   | 0.0091 | 5      |
| 64  | `/solutions/education`        | 390   | 43    | 0      | 0         | 0    | 3 (max 201) | 17 / 16.8               | 17 / 16.8                   | 0      | 4      |
| 65  | `/diagnostics`                | 390   | 43    | 0      | 0         | 0    | 3 (max 212) | 17 / 16.8               | 17 / 16.8                   | 0.0239 | 4      |
| 66  | `/demo/deploy`                | 390   | 43    | 0      | 0         | 0    | 3 (max 187) | 17 / 16.7               | 17 / 16.7                   | 0      | 4      |
| 67  | `/demo/scanner`               | 390   | 42    | 0      | 0         | 0    | 2 (max 114) | 17 / 16.7               | 17 / 16.8                   | 0.0238 | 4      |
| 68  | `/terms`                      | 390   | 42    | 0      | 0         | 0    | 2 (max 120) | 17 / 16.7               | 17 / 16.7                   | 0      | 4      |
| 69  | `/join`                       | 390   | 42    | 0      | 0         | 0    | 2 (max 108) | 17 / 16.8               | 17 / 16.7                   | 0      | 4      |
| 70  | `/pitch`                      | 390   | 42    | 0      | 0         | 0    | 2 (max 105) | 17 / 16.7               | 17 / 16.7                   | 0      | 4      |
| 71  | `/demo/qday`                  | 1440  | 41    | 0      | 0         | 0    | 1 (max 78)  | 17 / 16.7               | 17 / 16.7                   | 0.0217 | 4      |
| 72  | `/pitch`                      | 1440  | 41    | 0      | 0         | 0    | 1 (max 72)  | 17 / 16.8               | 17 / 16.7                   | 0      | 4      |
| 73  | `/solutions/fintech`          | 390   | 32    | 0      | 0         | 0    | 2 (max 199) | 17 / 16.8               | 17 / 16.7                   | 0      | 3      |
| 74  | `/solutions/healthcare`       | 390   | 32    | 0      | 0         | 0    | 2 (max 185) | 17 / 16.8               | 17 / 16.8                   | 0      | 3      |
| 75  | `/demos`                      | 390   | 32    | 0      | 0         | 0    | 2 (max 121) | 17 / 16.8               | 33 / 33.4                   | 0      | 3      |
| 76  | `/security`                   | 390   | 32    | 0      | 0         | 0    | 2 (max 115) | 17 / 16.8               | 17 / 16.7                   | 0      | 3      |
| 77  | `/changelog`                  | 390   | 32    | 0      | 0         | 0    | 2 (max 118) | 17 / 16.8               | 17 / 16.8                   | 0      | 3      |
| 78  | `/privacy`                    | 390   | 32    | 0      | 0         | 0    | 2 (max 117) | 17 / 16.8               | 17 / 16.7                   | 0      | 3      |
| 79  | `/demo/how-it-works`          | 390   | 23    | 0      | 0         | 0    | 3 (max 197) | 17 / 16.7               | 17 / 16.7                   | 0.0059 | 2      |
| 80  | `/demo/ledger`                | 390   | 23    | 0      | 0         | 0    | 3 (max 202) | 17 / 16.7               | 17 / 16.7                   | 0      | 2      |
| 81  | `/about`                      | 390   | 23    | 0      | 0         | 0    | 3 (max 188) | 17 / 16.7               | 17 / 16.7                   | 0      | 2      |
| 82  | `/demo/qday`                  | 390   | 3     | 0      | 0         | 0    | 3 (max 199) | 17 / 16.7               | 17 / 16.7                   | 0.0157 | 0      |

## Details

### `/docs/concepts/key-rotation` at 1440 (score 320)

- failed: /?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /platform?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /shield?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /solutions?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /pricing?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/api?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /changelog?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /about?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /security?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /contact?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /privacy?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=6_yHZT3Tb5PdBHUG (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=6_yHZT3Tb5PdBHUG (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=6_yHZT3Tb5PdBHUG (net::ERR_ABORTED)
- failed: /index?_rsc=6_yHZT3Tb5PdBHUG (net::ERR_ABORTED)

### `/docs/security-model` at 1440 (score 290)

- failed: /platform?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /shield?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /solutions?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /demos?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /pricing?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/api?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=qKiOHNskj0JCCwW5 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=qKiOHNskj0JCCwW5 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=qKiOHNskj0JCCwW5 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=qKiOHNskj0JCCwW5 (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /about?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /contact?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /changelog?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /privacy?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /terms?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)

### `/docs/adapters/edge` at 1440 (score 290)

- failed: /?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /platform?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /shield?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /demos?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /pricing?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/api?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=wkvWoIQEw9j83LrQ (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=wkvWoIQEw9j83LrQ (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=wkvWoIQEw9j83LrQ (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /about?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /contact?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /changelog?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /privacy?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)

### `/docs/adapters/vault` at 1440 (score 290)

- failed: /platform?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /shield?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /solutions?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /demos?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /pricing?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/api?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /about?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /security?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=kv9lsddgBKhJD5rs (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=kv9lsddgBKhJD5rs (net::ERR_ABORTED)
- failed: /join?_rsc=kv9lsddgBKhJD5rs (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /changelog?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /privacy?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)

### `/docs/concepts/hybrid-kem` at 1440 (score 290)

- failed: /?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /platform?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /shield?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /solutions?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /demos?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /pricing?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/api?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /changelog?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /security?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /contact?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /privacy?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=7xDt0A_MVBf5rktZ (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=7xDt0A_MVBf5rktZ (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=7xDt0A_MVBf5rktZ (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=7xDt0A_MVBf5rktZ (net::ERR_ABORTED)
- failed: /index?_rsc=7xDt0A_MVBf5rktZ (net::ERR_ABORTED)
- failed: /join?_rsc=7xDt0A_MVBf5rktZ (net::ERR_ABORTED)

### `/docs/concepts/sessions` at 1440 (score 290)

- failed: /?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /platform?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /shield?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /solutions?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /demos?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /pricing?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/api?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /security?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /contact?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /privacy?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /about?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=-z7zyCPbfJKqBtEY (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=-z7zyCPbfJKqBtEY (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=-z7zyCPbfJKqBtEY (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=-z7zyCPbfJKqBtEY (net::ERR_ABORTED)
- failed: /index?_rsc=-z7zyCPbfJKqBtEY (net::ERR_ABORTED)
- failed: /join?_rsc=-z7zyCPbfJKqBtEY (net::ERR_ABORTED)

### `/docs/concepts/signatures` at 1440 (score 290)

- failed: /?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /shield?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /solutions?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /demos?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /platform?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /pricing?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/api?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /changelog?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /privacy?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /contact?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=7bVME0r6j-Fvcmtf (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=7bVME0r6j-Fvcmtf (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=7bVME0r6j-Fvcmtf (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=7bVME0r6j-Fvcmtf (net::ERR_ABORTED)
- failed: /index?_rsc=7bVME0r6j-Fvcmtf (net::ERR_ABORTED)
- failed: /join?_rsc=7bVME0r6j-Fvcmtf (net::ERR_ABORTED)

### `/docs/adapters/shield` at 1440 (score 270)

- failed: /?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /platform?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /shield?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /demos?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /solutions?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /pricing?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/api?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=n8f0dZreNMTPCDj2 (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=n8f0dZreNMTPCDj2 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=n8f0dZreNMTPCDj2 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=n8f0dZreNMTPCDj2 (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /security?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /changelog?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /privacy?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)

### `/docs/adapters/web` at 1440 (score 270)

- failed: /?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /platform?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /solutions?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /demos?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /pricing?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/api?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=XftLZ3UCnnNkeN9O (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=XftLZ3UCnnNkeN9O (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=XftLZ3UCnnNkeN9O (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=XftLZ3UCnnNkeN9O (net::ERR_ABORTED)
- failed: /index?_rsc=XftLZ3UCnnNkeN9O (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /security?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /contact?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)

### `/docs/concepts` at 1440 (score 270)

- failed: /?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /platform?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /shield?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /solutions?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /demos?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /pricing?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/api?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /about?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /security?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /contact?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /privacy?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=XhJMm7VSZ5zT8J-b (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=XhJMm7VSZ5zT8J-b (net::ERR_ABORTED)
- failed: /index?_rsc=XhJMm7VSZ5zT8J-b (net::ERR_ABORTED)
- failed: /join?_rsc=XhJMm7VSZ5zT8J-b (net::ERR_ABORTED)

### `/docs/api` at 1440 (score 260)

- failed: /platform?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /solutions?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /demos?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /pricing?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=ZEGLIF8C-3DXSnI0 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=ZEGLIF8C-3DXSnI0 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=ZEGLIF8C-3DXSnI0 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=ZEGLIF8C-3DXSnI0 (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /about?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)

### `/solutions/healthcare` at 1440 (score 251)

- long tasks: 97 ms
- failed: /shield?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /solutions?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /platform?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /demos?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /docs?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /pricing?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=Bt4bAK-uhjfiVdYp (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=Bt4bAK-uhjfiVdYp (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=Bt4bAK-uhjfiVdYp (net::ERR_ABORTED)
- failed: /join?_rsc=Bt4bAK-uhjfiVdYp (net::ERR_ABORTED)
- failed: /index?_rsc=Bt4bAK-uhjfiVdYp (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=Bt4bAK-uhjfiVdYp (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /about?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /security?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /docs/api?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /contact?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /changelog?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /privacy?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)

### `/shield` at 1440 (score 250)

- failed: /platform?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /solutions?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /demos?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /docs?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /pricing?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /app?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /shield/live?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=Cl5qVxdK7x_EkJZi (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=Cl5qVxdK7x_EkJZi (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=Cl5qVxdK7x_EkJZi (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=Cl5qVxdK7x_EkJZi (net::ERR_ABORTED)
- failed: /index?_rsc=Cl5qVxdK7x_EkJZi (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /about?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /security?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /docs/api?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /contact?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /changelog?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /privacy?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)

### `/shield/live` at 1440 (score 250)

- failed: /?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /platform?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /shield?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /solutions?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /demos?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /pricing?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /docs?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /about?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /security?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=qf1TO_W2Uutzm343 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=qf1TO_W2Uutzm343 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=qf1TO_W2Uutzm343 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=qf1TO_W2Uutzm343 (net::ERR_ABORTED)
- failed: /index?_rsc=qf1TO_W2Uutzm343 (net::ERR_ABORTED)
- failed: /join?_rsc=qf1TO_W2Uutzm343 (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /docs/api?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /contact?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /changelog?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /privacy?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)

### `/docs` at 1440 (score 250)

- failed: /demos?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /platform?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /shield?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /pricing?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=-yZNePjRDOH8dHa4 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=-yZNePjRDOH8dHa4 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=-yZNePjRDOH8dHa4 (net::ERR_ABORTED)
- failed: /index?_rsc=-yZNePjRDOH8dHa4 (net::ERR_ABORTED)
- failed: /join?_rsc=-yZNePjRDOH8dHa4 (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /about?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /security?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /contact?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)

### `/solutions/education` at 1440 (score 241)

- long tasks: 95 ms
- failed: /platform?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /shield?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /solutions?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /demos?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /docs?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /pricing?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=zkRnjQUQJYniuD5_ (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=zkRnjQUQJYniuD5_ (net::ERR_ABORTED)
- failed: /index?_rsc=zkRnjQUQJYniuD5_ (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=zkRnjQUQJYniuD5_ (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /about?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /security?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /docs/api?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /contact?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /changelog?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /privacy?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /terms?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)

### `/index` at 1440 (score 241)

- long tasks: 106 ms
- failed: /platform?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /shield?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /solutions?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /demos?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /docs?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /pricing?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=li3HOL36sEipfFMQ (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=li3HOL36sEipfFMQ (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=li3HOL36sEipfFMQ (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=li3HOL36sEipfFMQ (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /about?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /security?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /docs/api?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /contact?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /changelog?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /privacy?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /terms?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)

### `/security` at 1440 (score 240)

- failed: /platform?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /shield?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /solutions?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /demos?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /pricing?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /docs?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=YyJpiOpUMgxYTgWR (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=YyJpiOpUMgxYTgWR (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=YyJpiOpUMgxYTgWR (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=YyJpiOpUMgxYTgWR (net::ERR_ABORTED)
- failed: /index?_rsc=YyJpiOpUMgxYTgWR (net::ERR_ABORTED)
- failed: /join?_rsc=YyJpiOpUMgxYTgWR (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /about?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /docs/api?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /contact?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /changelog?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /privacy?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /terms?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)

### `/terms` at 1440 (score 240)

- failed: /?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /platform?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /shield?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /solutions?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /demos?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /docs?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /pricing?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=PVgkf2z9MJ5DB4vO (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=PVgkf2z9MJ5DB4vO (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=PVgkf2z9MJ5DB4vO (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=PVgkf2z9MJ5DB4vO (net::ERR_ABORTED)
- failed: /index?_rsc=PVgkf2z9MJ5DB4vO (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /about?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /security?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /docs/api?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /contact?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /changelog?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /privacy?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)

### `/scan/www.irctc.co.in` at 1440 (score 240)

- failed: /?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /platform?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /shield?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /solutions?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /demos?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /docs?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /pricing?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=omhYoygxHSoetFhJ (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=omhYoygxHSoetFhJ (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=omhYoygxHSoetFhJ (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=omhYoygxHSoetFhJ (net::ERR_ABORTED)
- failed: /index?_rsc=omhYoygxHSoetFhJ (net::ERR_ABORTED)
- failed: /join?_rsc=omhYoygxHSoetFhJ (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /about?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /docs/api?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /contact?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /changelog?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /privacy?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)

### `/this-page-does-not-exist` at 1440 (score 240)

- console error: Failed to load resource: the server responded with a status of 404 (Not Found)
- console error: Failed to load resource: net::ERR_NETWORK_IO_SUSPENDED
- failed: /this-page-does-not-exist (HTTP 404)
- failed: /demos?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /platform?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /shield?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /pricing?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /changelog?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /docs?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /docs/api?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /about?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=gP-dKIzQhcdxdKSx (net::ERR_ABORTED)
- failed: /index?_rsc=gP-dKIzQhcdxdKSx (net::ERR_ABORTED)
- failed: /join?_rsc=gP-dKIzQhcdxdKSx (net::ERR_ABORTED)
- failed: /api/stream (net::ERR_NETWORK_IO_SUSPENDED)
- failed: /api/health (net::ERR_ABORTED)

### `/solutions/government` at 1440 (score 231)

- long tasks: 100 ms
- failed: /?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /platform?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /shield?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /solutions?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /demos?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /docs?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /pricing?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=uqhsyBNQ7mioKwOT (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=uqhsyBNQ7mioKwOT (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=uqhsyBNQ7mioKwOT (net::ERR_ABORTED)
- failed: /join?_rsc=uqhsyBNQ7mioKwOT (net::ERR_ABORTED)
- failed: /index?_rsc=uqhsyBNQ7mioKwOT (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /security?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /docs/api?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /contact?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /changelog?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /privacy?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)

### `/docs/adapters/sdk` at 1440 (score 230)

- failed: /platform?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /shield?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /solutions?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /demos?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /pricing?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/api?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /join?_rsc=xiFmjObillsgkiqD (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /about?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /security?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /changelog?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /privacy?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)

### `/demos` at 1440 (score 220)

- failed: /?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /platform?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /shield?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /solutions?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /docs?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /pricing?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=v0d3kxW6pJe8X4cc (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=v0d3kxW6pJe8X4cc (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=v0d3kxW6pJe8X4cc (net::ERR_ABORTED)
- failed: /index?_rsc=v0d3kxW6pJe8X4cc (net::ERR_ABORTED)
- failed: /join?_rsc=v0d3kxW6pJe8X4cc (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /security?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /docs/api?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /contact?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /changelog?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /privacy?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /terms?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)

### `/changelog` at 1440 (score 220)

- failed: /shield?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /solutions?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /demos?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /platform?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /docs?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /pricing?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=YcWaCux-N8fbPgQB (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=YcWaCux-N8fbPgQB (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=YcWaCux-N8fbPgQB (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=YcWaCux-N8fbPgQB (net::ERR_ABORTED)
- failed: /index?_rsc=YcWaCux-N8fbPgQB (net::ERR_ABORTED)
- failed: /join?_rsc=YcWaCux-N8fbPgQB (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /security?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /docs/api?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /contact?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /privacy?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)

### `/privacy` at 1440 (score 220)

- failed: /platform?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /shield?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /solutions?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /demos?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /docs?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /pricing?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=hWY7gX7Gns5i7uOm (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=hWY7gX7Gns5i7uOm (net::ERR_ABORTED)
- failed: /index?_rsc=hWY7gX7Gns5i7uOm (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=hWY7gX7Gns5i7uOm (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /about?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /security?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /docs/api?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /contact?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /changelog?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)

### `/platform` at 1440 (score 211)

- long tasks: 100 ms
- failed: /demos?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /shield?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /solutions?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /docs?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /pricing?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=igG17uxtuZnTNGU2 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=igG17uxtuZnTNGU2 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=igG17uxtuZnTNGU2 (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /about?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /security?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /docs/api?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /contact?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /changelog?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /privacy?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)

### `/docs/concepts/key-rotation` at 390 (score 202)

- long tasks: 54, 132 ms
- failed: /docs?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/api?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=6_yHZT3Tb5PdBHUG (net::ERR_ABORTED)
- failed: /index?_rsc=6_yHZT3Tb5PdBHUG (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=6_yHZT3Tb5PdBHUG (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=6_yHZT3Tb5PdBHUG (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /platform?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /pricing?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)

### `/about` at 1440 (score 201)

- long tasks: 103 ms
- failed: /?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /platform?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /shield?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /solutions?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /demos?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /docs?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /pricing?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=kL8YMqvKhVCpUJei (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=kL8YMqvKhVCpUJei (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=kL8YMqvKhVCpUJei (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=kL8YMqvKhVCpUJei (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /security?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /docs/api?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /changelog?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /privacy?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)

### `/shield/live` at 390 (score 192)

- long tasks: 58, 138 ms
- failed: /?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=qf1TO_W2Uutzm343 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=qf1TO_W2Uutzm343 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=qf1TO_W2Uutzm343 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=qf1TO_W2Uutzm343 (net::ERR_ABORTED)
- failed: /platform?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /pricing?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /changelog?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /docs?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /docs/api?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /demos?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)

### `/docs/concepts` at 390 (score 182)

- long tasks: 55, 122 ms
- failed: /docs?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/api?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=XhJMm7VSZ5zT8J-b (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=XhJMm7VSZ5zT8J-b (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /pricing?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /changelog?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)

### `/solutions/fintech` at 1440 (score 181)

- long tasks: 94 ms
- failed: /?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /shield?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /demos?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /platform?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /pricing?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /docs?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=1s1cDpN3PerCYgd4 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=1s1cDpN3PerCYgd4 (net::ERR_ABORTED)
- failed: /join?_rsc=1s1cDpN3PerCYgd4 (net::ERR_ABORTED)
- failed: /index?_rsc=1s1cDpN3PerCYgd4 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=1s1cDpN3PerCYgd4 (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /security?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /changelog?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /privacy?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)

### `/pricing` at 1440 (score 180)

- failed: /?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /platform?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /solutions?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /docs?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /contact?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=mf32xbX59GT2m-y9 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=mf32xbX59GT2m-y9 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=mf32xbX59GT2m-y9 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=mf32xbX59GT2m-y9 (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /security?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /docs/api?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /changelog?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /privacy?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)

### `/docs/adapters/edge` at 390 (score 172)

- long tasks: 54, 122 ms
- failed: /?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/api?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=wkvWoIQEw9j83LrQ (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=wkvWoIQEw9j83LrQ (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=wkvWoIQEw9j83LrQ (net::ERR_ABORTED)
- failed: /index?_rsc=wkvWoIQEw9j83LrQ (net::ERR_ABORTED)
- failed: /join?_rsc=wkvWoIQEw9j83LrQ (net::ERR_ABORTED)

### `/this-page-does-not-exist` at 390 (score 167)

- console error: Failed to load resource: the server responded with a status of 404 (Not Found)
- long tasks: 56, 122 ms
- failed: /this-page-does-not-exist (HTTP 404)
- failed: /?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /platform?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /pricing?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /changelog?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=gP-dKIzQhcdxdKSx (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=gP-dKIzQhcdxdKSx (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=gP-dKIzQhcdxdKSx (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /demos?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)

### `/docs/adapters/vault` at 390 (score 162)

- long tasks: 55, 125 ms
- failed: /?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/api?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=kv9lsddgBKhJD5rs (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=kv9lsddgBKhJD5rs (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /platform?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /pricing?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)

### `/` at 1440 (score 161)

- long tasks: 110 ms
- layout shift 0.0023: div.mt-8
- failed: /platform?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /shield?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /solutions?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /demos?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /docs?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /pricing?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /diagnostics?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /docs/api?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /about?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /security?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /contact?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /changelog?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /privacy?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)

### `/solutions` at 1440 (score 161)

- long tasks: 98 ms
- failed: /?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)
- failed: /platform?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)
- failed: /shield?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)
- failed: /demos?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)
- failed: /docs?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)
- failed: /pricing?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=OORq0xsJAT4Ux3pG (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=OORq0xsJAT4Ux3pG (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=OORq0xsJAT4Ux3pG (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)
- failed: /docs/api?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)
- failed: /changelog?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)
- failed: /privacy?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)

### `/docs` at 390 (score 152)

- long tasks: 57, 126 ms
- failed: /?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/api?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=-yZNePjRDOH8dHa4 (net::ERR_ABORTED)
- failed: /index?_rsc=-yZNePjRDOH8dHa4 (net::ERR_ABORTED)

### `/docs/api` at 390 (score 142)

- long tasks: 54, 118 ms
- failed: /docs?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=ZEGLIF8C-3DXSnI0 (net::ERR_ABORTED)

### `/docs/adapters/shield` at 390 (score 142)

- long tasks: 54, 122 ms
- failed: /?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/api?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=n8f0dZreNMTPCDj2 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=n8f0dZreNMTPCDj2 (net::ERR_ABORTED)

### `/contact` at 1440 (score 140)

- failed: /platform?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /shield?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /solutions?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /demos?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /docs?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /pricing?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=HqxYgmTx6NZNLxiF (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=HqxYgmTx6NZNLxiF (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=HqxYgmTx6NZNLxiF (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /security?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)

### `/docs/adapters/sdk` at 390 (score 132)

- long tasks: 57, 123 ms
- failed: /?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/api?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=xiFmjObillsgkiqD (net::ERR_ABORTED)

### `/docs/security-model` at 390 (score 122)

- long tasks: 59, 138 ms
- failed: /?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/api?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=qKiOHNskj0JCCwW5 (net::ERR_ABORTED)

### `/docs/adapters/web` at 390 (score 122)

- long tasks: 54, 120 ms
- failed: /docs?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/api?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)

### `/docs/concepts/hybrid-kem` at 390 (score 122)

- long tasks: 55, 126 ms
- failed: /?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/api?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=7xDt0A_MVBf5rktZ (net::ERR_ABORTED)

### `/docs/concepts/signatures` at 390 (score 122)

- long tasks: 55, 121 ms
- failed: /?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/api?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=7bVME0r6j-Fvcmtf (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=7bVME0r6j-Fvcmtf (net::ERR_ABORTED)
- failed: /pricing?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)

### `/docs/concepts/sessions` at 390 (score 112)

- long tasks: 55, 120 ms
- failed: /?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=-z7zyCPbfJKqBtEY (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=-z7zyCPbfJKqBtEY (net::ERR_ABORTED)
- failed: /platform?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)

### `/scan/www.irctc.co.in` at 390 (score 102)

- long tasks: 57, 120 ms
- failed: /demo/deploy?_rsc=omhYoygxHSoetFhJ (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=omhYoygxHSoetFhJ (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=omhYoygxHSoetFhJ (net::ERR_ABORTED)
- failed: /index?_rsc=omhYoygxHSoetFhJ (net::ERR_ABORTED)
- failed: /platform?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /pricing?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /changelog?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /docs/api?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /demos?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)

### `/contact` at 390 (score 92)

- long tasks: 54, 117 ms
- failed: /demo/deploy?_rsc=HqxYgmTx6NZNLxiF (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=HqxYgmTx6NZNLxiF (net::ERR_ABORTED)
- failed: /index?_rsc=HqxYgmTx6NZNLxiF (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=HqxYgmTx6NZNLxiF (net::ERR_ABORTED)
- failed: /platform?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /changelog?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)

### `/join` at 1440 (score 86)

- console error: Failed to load resource: net::ERR_NETWORK_IO_SUSPENDED
- long tasks: 55 ms
- layout shift 0.0132: fieldset.mt-8, ::after.
- failed: /?_rsc=ZKT-nziZdQWI1pvG (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=a87G1evOvoS83bya (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=a87G1evOvoS83bya (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=a87G1evOvoS83bya (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=a87G1evOvoS83bya (net::ERR_ABORTED)
- failed: /index?_rsc=a87G1evOvoS83bya (net::ERR_ABORTED)
- failed: /api/stream (net::ERR_NETWORK_IO_SUSPENDED)

### `/` at 390 (score 83)

- long tasks: 112, 88, 90, 69, 129, 195 ms
- layout shift 0.0054: div.absolute.right-5.top-6
- failed: /demo/qday?_rsc=ZmCQ44b92m4mXe_R (net::ERR_ABORTED)
- failed: /index?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /api/health (net::ERR_ABORTED)

### `/platform` at 390 (score 79)

- long tasks: 91, 403 ms
- failed: /demos?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /docs?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /api/health (net::ERR_ABORTED)

### `/shield` at 390 (score 72)

- long tasks: 67, 108 ms
- failed: /shield/live?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /app?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=Cl5qVxdK7x_EkJZi (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=Cl5qVxdK7x_EkJZi (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=Cl5qVxdK7x_EkJZi (net::ERR_ABORTED)
- failed: /index?_rsc=Cl5qVxdK7x_EkJZi (net::ERR_ABORTED)

### `/diagnostics` at 1440 (score 71)

- long tasks: 80 ms
- layout shift 0.0011: button.hidden.h-8.rounded-sm, button.h-8.rounded-sm.border, (text), dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right
- failed: /?_rsc=5uLgBCEKVAcDC1CS (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=X1OHO8Wm4TCDMONl (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=X1OHO8Wm4TCDMONl (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=X1OHO8Wm4TCDMONl (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=X1OHO8Wm4TCDMONl (net::ERR_ABORTED)
- failed: /index?_rsc=X1OHO8Wm4TCDMONl (net::ERR_ABORTED)
- failed: /join?_rsc=X1OHO8Wm4TCDMONl (net::ERR_ABORTED)

### `/demo/scanner` at 1440 (score 70)

- failed: /demos?_rsc=cFioy5qGKfabZFhF (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=XOdE9CWIKECMXNsK (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=XOdE9CWIKECMXNsK (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=XOdE9CWIKECMXNsK (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=XOdE9CWIKECMXNsK (net::ERR_ABORTED)
- failed: /index?_rsc=XOdE9CWIKECMXNsK (net::ERR_ABORTED)
- failed: /join?_rsc=XOdE9CWIKECMXNsK (net::ERR_ABORTED)

### `/solutions` at 390 (score 63)

- long tasks: 57, 115, 202 ms
- failed: /?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=OORq0xsJAT4Ux3pG (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=OORq0xsJAT4Ux3pG (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=OORq0xsJAT4Ux3pG (net::ERR_ABORTED)
- failed: /index?_rsc=OORq0xsJAT4Ux3pG (net::ERR_ABORTED)

### `/solutions/government` at 390 (score 63)

- long tasks: 52, 116, 185 ms
- failed: /?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=uqhsyBNQ7mioKwOT (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=uqhsyBNQ7mioKwOT (net::ERR_ABORTED)
- failed: /index?_rsc=uqhsyBNQ7mioKwOT (net::ERR_ABORTED)
- failed: /join?_rsc=uqhsyBNQ7mioKwOT (net::ERR_ABORTED)

### `/pricing` at 390 (score 62)

- long tasks: 52, 114 ms
- failed: /?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /docs?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=mf32xbX59GT2m-y9 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=mf32xbX59GT2m-y9 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=mf32xbX59GT2m-y9 (net::ERR_ABORTED)
- failed: /index?_rsc=mf32xbX59GT2m-y9 (net::ERR_ABORTED)

### `/demo/deploy` at 1440 (score 61)

- long tasks: 80 ms
- failed: /demos?_rsc=kqn8NtDtrZ53EOk8 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=HAx0ck6KAccnSpQw (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=HAx0ck6KAccnSpQw (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=HAx0ck6KAccnSpQw (net::ERR_ABORTED)
- failed: /index?_rsc=HAx0ck6KAccnSpQw (net::ERR_ABORTED)
- failed: /join?_rsc=HAx0ck6KAccnSpQw (net::ERR_ABORTED)

### `/demo/ledger` at 1440 (score 61)

- long tasks: 81 ms
- layout shift 0.0033: div.ml-auto.flex.flex-wrap, div.pr-6.md:border-l.md:border-line, div.pr-6.md:border-l.md:border-line, div.pr-6.md:border-l.md:border-line, div.pr-6.md:border-l.md:border-line
- failed: /demos?_rsc=qePgz_B-wUDGm_7C (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=r_APt36-VFXudRiP (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=r_APt36-VFXudRiP (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=r_APt36-VFXudRiP (net::ERR_ABORTED)
- failed: /index?_rsc=r_APt36-VFXudRiP (net::ERR_ABORTED)
- failed: /join?_rsc=r_APt36-VFXudRiP (net::ERR_ABORTED)

### `/index` at 390 (score 53)

- long tasks: 53, 95, 189 ms
- failed: /?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=li3HOL36sEipfFMQ (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=li3HOL36sEipfFMQ (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=li3HOL36sEipfFMQ (net::ERR_ABORTED)
- failed: /join?_rsc=li3HOL36sEipfFMQ (net::ERR_ABORTED)

### `/demo/how-it-works` at 1440 (score 51)

- long tasks: 81 ms
- layout shift 0.007: div.pointer-events-none.absolute.inset-x-0, div.pr-6.md:border-l.md:border-line, div.pr-6.md:border-l.md:border-line, div.pr-6.md:border-l.md:border-line, div.pr-6.md:border-l.md:border-line
- failed: /demos?_rsc=wZyECymZZ2VIot9Z (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=CVhrOiiOx8uuK5BS (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=CVhrOiiOx8uuK5BS (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=CVhrOiiOx8uuK5BS (net::ERR_ABORTED)
- failed: /index?_rsc=CVhrOiiOx8uuK5BS (net::ERR_ABORTED)

### `/solutions/education` at 390 (score 43)

- long tasks: 52, 118, 201 ms
- failed: /demo/how-it-works?_rsc=zkRnjQUQJYniuD5_ (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=zkRnjQUQJYniuD5_ (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=zkRnjQUQJYniuD5_ (net::ERR_ABORTED)
- failed: /index?_rsc=zkRnjQUQJYniuD5_ (net::ERR_ABORTED)

### `/diagnostics` at 390 (score 43)

- long tasks: 63, 68, 212 ms
- layout shift 0.0131: div.absolute.bottom-3.left-3, button.h-8.rounded-sm.border, button.h-8.rounded-sm.border, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right
- layout shift 0.0076: button.h-8.rounded-sm.border, (text), dd.min-w-0.truncate.text-right
- layout shift 0.0019: dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, (text), dd.min-w-0.truncate.text-right
- layout shift 0.0013: div.absolute.bottom-3.left-3
- failed: /demo/deploy?_rsc=X1OHO8Wm4TCDMONl (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=X1OHO8Wm4TCDMONl (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=X1OHO8Wm4TCDMONl (net::ERR_ABORTED)
- failed: /index?_rsc=X1OHO8Wm4TCDMONl (net::ERR_ABORTED)

### `/demo/deploy` at 390 (score 43)

- long tasks: 54, 140, 187 ms
- failed: /demo/qday?_rsc=HAx0ck6KAccnSpQw (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=HAx0ck6KAccnSpQw (net::ERR_ABORTED)
- failed: /index?_rsc=HAx0ck6KAccnSpQw (net::ERR_ABORTED)
- failed: /join?_rsc=HAx0ck6KAccnSpQw (net::ERR_ABORTED)

### `/demo/scanner` at 390 (score 42)

- long tasks: 55, 114 ms
- layout shift 0.0238: textarea#scan-input.h-stage-sm.w-full.resize-y, div.inline-flex.flex-wrap.rounded-sm
- failed: /demo/deploy?_rsc=XOdE9CWIKECMXNsK (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=XOdE9CWIKECMXNsK (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=XOdE9CWIKECMXNsK (net::ERR_ABORTED)
- failed: /index?_rsc=XOdE9CWIKECMXNsK (net::ERR_ABORTED)

### `/terms` at 390 (score 42)

- long tasks: 52, 120 ms
- failed: /demo/deploy?_rsc=PVgkf2z9MJ5DB4vO (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=PVgkf2z9MJ5DB4vO (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=PVgkf2z9MJ5DB4vO (net::ERR_ABORTED)
- failed: /index?_rsc=PVgkf2z9MJ5DB4vO (net::ERR_ABORTED)

### `/join` at 390 (score 42)

- long tasks: 54, 108 ms
- failed: /demo/qday?_rsc=a87G1evOvoS83bya (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=a87G1evOvoS83bya (net::ERR_ABORTED)
- failed: /index?_rsc=a87G1evOvoS83bya (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=a87G1evOvoS83bya (net::ERR_ABORTED)

### `/pitch` at 390 (score 42)

- long tasks: 56, 105 ms
- failed: /demo/how-it-works?_rsc=MyG8qYdSY3bNpC4n (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=MyG8qYdSY3bNpC4n (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=MyG8qYdSY3bNpC4n (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=MyG8qYdSY3bNpC4n (net::ERR_ABORTED)

### `/demo/qday` at 1440 (score 41)

- long tasks: 78 ms
- layout shift 0.0122: div.pointer-events-none.absolute.inset-x-0
- layout shift 0.003: li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3
- failed: /demos?_rsc=fkENv3RCJmSH95Zg (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=WVgpNe78MT_28VeH (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=WVgpNe78MT_28VeH (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=WVgpNe78MT_28VeH (net::ERR_ABORTED)

### `/pitch` at 1440 (score 41)

- long tasks: 72 ms
- failed: /demo/qday?_rsc=MyG8qYdSY3bNpC4n (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=MyG8qYdSY3bNpC4n (net::ERR_ABORTED)
- failed: /index?_rsc=MyG8qYdSY3bNpC4n (net::ERR_ABORTED)
- failed: /join?_rsc=MyG8qYdSY3bNpC4n (net::ERR_ABORTED)

### `/solutions/fintech` at 390 (score 32)

- long tasks: 115, 199 ms
- failed: /?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /index?_rsc=1s1cDpN3PerCYgd4 (net::ERR_ABORTED)

### `/solutions/healthcare` at 390 (score 32)

- long tasks: 111, 185 ms
- failed: /demo/deploy?_rsc=Bt4bAK-uhjfiVdYp (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=Bt4bAK-uhjfiVdYp (net::ERR_ABORTED)
- failed: /index?_rsc=Bt4bAK-uhjfiVdYp (net::ERR_ABORTED)

### `/demos` at 390 (score 32)

- long tasks: 54, 121 ms
- failed: /demo/how-it-works?_rsc=v0d3kxW6pJe8X4cc (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=v0d3kxW6pJe8X4cc (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=v0d3kxW6pJe8X4cc (net::ERR_ABORTED)

### `/security` at 390 (score 32)

- long tasks: 52, 115 ms
- failed: /demo/qday?_rsc=YyJpiOpUMgxYTgWR (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=YyJpiOpUMgxYTgWR (net::ERR_ABORTED)
- failed: /?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)

### `/changelog` at 390 (score 32)

- long tasks: 52, 118 ms
- failed: /demo/deploy?_rsc=YcWaCux-N8fbPgQB (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=YcWaCux-N8fbPgQB (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=YcWaCux-N8fbPgQB (net::ERR_ABORTED)

### `/privacy` at 390 (score 32)

- long tasks: 53, 117 ms
- failed: /demo/deploy?_rsc=hWY7gX7Gns5i7uOm (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=hWY7gX7Gns5i7uOm (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=hWY7gX7Gns5i7uOm (net::ERR_ABORTED)

### `/demo/how-it-works` at 390 (score 23)

- long tasks: 54, 66, 197 ms
- layout shift 0.0059: div.pointer-events-none.absolute.inset-x-0
- failed: /demo/qday?_rsc=CVhrOiiOx8uuK5BS (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=CVhrOiiOx8uuK5BS (net::ERR_ABORTED)

### `/demo/ledger` at 390 (score 23)

- long tasks: 55, 65, 202 ms
- failed: /demos?_rsc=qePgz_B-wUDGm_7C (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=r_APt36-VFXudRiP (net::ERR_ABORTED)

### `/about` at 390 (score 23)

- long tasks: 51, 113, 188 ms
- failed: /?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=kL8YMqvKhVCpUJei (net::ERR_ABORTED)

### `/demo/qday` at 390 (score 3)

- long tasks: 54, 64, 199 ms
- layout shift 0.0095: li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3
- layout shift 0.0059: div.pointer-events-none.absolute.inset-x-0
