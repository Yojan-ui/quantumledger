# Glitch audit (after)

`pnpm audit:glitch after` against the production build at http://localhost:3000, 2026-10-30T17:38 UTC.
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
| Long tasks > 50 ms               | 16     | 76           |
| Worst frame while scrolling (ms) | 33     | 50           |
| Worst frame in a transition (ms) | 34     | 34           |
| Worst page CLS                   | 0.0738 | 0.0364       |
| Failed requests                  | 2      | 1            |

## Before → after

`audit-before.md` (2026-10-30T11:23 UTC, before the Q-Shield integration: 39 pages) against this run
(49 pages: the same 39 plus 10 new Q-Shield routes, `/atlas/demo/*` and `/diagnostics?ws=demo`). Counts
are totals over all pages, so the after column covers more pages.

|                                  | Before 1440 | After 1440 | Before 390 | After 390 |
| -------------------------------- | ----------- | ---------- | ---------- | --------- |
| Console errors + page errors     | 1           | 1          | 1          | 1         |
| Hydration warnings               | 0           | 0          | 0          | 0         |
| WebGL contexts lost              | 0           | 0          | 0          | 0         |
| Long tasks > 50 ms               | 15          | 16         | 68         | 76        |
| Worst frame while scrolling (ms) | 33          | 33         | 167        | 50        |
| Worst frame in a transition (ms) | 83          | 34         | 183        | 34        |
| Worst page CLS                   | 0.0131      | 0.0738     | 0.0367     | 0.0364    |
| Failed requests                  | 1           | 2          | 1          | 1         |

- The one console error at each width is the deliberate 404 page (`/this-page-does-not-exist`), before and after.
- The extra failed request at 1440 is a Next.js prefetch of `/diagnostics` from `/`, aborted when the
  10-second run closed the page (`net::ERR_ABORTED`), not a server error.
- Worst CLS at 1440 is `/diagnostics?ws=demo` (0.0738, under the 0.1 "good" threshold): the Atlas HUD's
  panels fill in once the workspace's results load. `/atlas/demo/review` is 0.0122 (0.1886 in an interim run before the fix).
- `/demos` on the phone: worst frames 167 / 183 ms before, 33 / 34 ms after.

## Ranked (worst first)

| #   | Page                          | Width | Score | Errors | Hydration | Lost | Long tasks  | Scroll worst / p95 (ms) | Transition worst / p95 (ms) | CLS    | Failed |
| --- | ----------------------------- | ----- | ----- | ------ | --------- | ---- | ----------- | ----------------------- | --------------------------- | ------ | ------ |
| 1   | `/this-page-does-not-exist`   | 390   | 26    | 1      | 0         | 0    | 1 (max 52)  | 17 / 16.7               | 17 / 16.7                   | 0      | 1      |
| 2   | `/this-page-does-not-exist`   | 1440  | 25    | 1      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 1      |
| 3   | `/`                           | 1440  | 11    | 0      | 0         | 0    | 1 (max 83)  | 17 / 16.7               | 17 / 16.8                   | 0.0067 | 1      |
| 4   | `/diagnostics?ws=demo`        | 1440  | 6     | 0      | 0         | 0    | 1 (max 68)  | 17 / 16.8               | 17 / 16.7                   | 0.0738 | 0      |
| 5   | `/`                           | 390   | 4     | 0      | 0         | 0    | 4 (max 188) | 33 / 16.7               | 17 / 16.7                   | 0.0002 | 0      |
| 6   | `/diagnostics`                | 390   | 4     | 0      | 0         | 0    | 4 (max 186) | 17 / 16.8               | 17 / 16.7                   | 0.0364 | 0      |
| 7   | `/solutions`                  | 390   | 3     | 0      | 0         | 0    | 3 (max 169) | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 8   | `/solutions/fintech`          | 390   | 3     | 0      | 0         | 0    | 3 (max 176) | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 9   | `/solutions/healthcare`       | 390   | 3     | 0      | 0         | 0    | 3 (max 164) | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 10  | `/solutions/education`        | 390   | 3     | 0      | 0         | 0    | 3 (max 165) | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 11  | `/solutions/government`       | 390   | 3     | 0      | 0         | 0    | 3 (max 167) | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 12  | `/index`                      | 390   | 3     | 0      | 0         | 0    | 3 (max 184) | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 13  | `/demo/how-it-works`          | 390   | 3     | 0      | 0         | 0    | 3 (max 181) | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 14  | `/demo/deploy`                | 390   | 3     | 0      | 0         | 0    | 3 (max 166) | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 15  | `/demo/qday`                  | 390   | 3     | 0      | 0         | 0    | 3 (max 177) | 17 / 16.8               | 17 / 16.7                   | 0.0098 | 0      |
| 16  | `/demo/ledger`                | 390   | 3     | 0      | 0         | 0    | 3 (max 179) | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 17  | `/about`                      | 390   | 3     | 0      | 0         | 0    | 3 (max 163) | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 18  | `/diagnostics?ws=demo`        | 390   | 3     | 0      | 0         | 0    | 3 (max 170) | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 19  | `/platform`                   | 390   | 2     | 0      | 0         | 0    | 2 (max 195) | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 20  | `/atlas/demo/ledger`          | 390   | 2     | 0      | 0         | 0    | 2 (max 64)  | 50 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 21  | `/platform`                   | 1440  | 1     | 0      | 0         | 0    | 1 (max 65)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 22  | `/solutions`                  | 1440  | 1     | 0      | 0         | 0    | 1 (max 84)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 23  | `/solutions/fintech`          | 1440  | 1     | 0      | 0         | 0    | 1 (max 72)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 24  | `/solutions/healthcare`       | 1440  | 1     | 0      | 0         | 0    | 1 (max 86)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 25  | `/solutions/education`        | 1440  | 1     | 0      | 0         | 0    | 1 (max 68)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 26  | `/solutions/government`       | 1440  | 1     | 0      | 0         | 0    | 1 (max 65)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 27  | `/diagnostics`                | 1440  | 1     | 0      | 0         | 0    | 1 (max 70)  | 17 / 16.7               | 17 / 16.8                   | 0.004  | 0      |
| 28  | `/index`                      | 1440  | 1     | 0      | 0         | 0    | 1 (max 81)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 29  | `/demo/how-it-works`          | 1440  | 1     | 0      | 0         | 0    | 1 (max 72)  | 17 / 16.8               | 17 / 16.7                   | 0.0013 | 0      |
| 30  | `/demo/deploy`                | 1440  | 1     | 0      | 0         | 0    | 1 (max 70)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 31  | `/demo/qday`                  | 1440  | 1     | 0      | 0         | 0    | 1 (max 72)  | 17 / 16.8               | 17 / 16.7                   | 0.002  | 0      |
| 32  | `/demo/ledger`                | 1440  | 1     | 0      | 0         | 0    | 1 (max 72)  | 17 / 16.7               | 17 / 16.7                   | 0.0016 | 0      |
| 33  | `/about`                      | 1440  | 1     | 0      | 0         | 0    | 1 (max 78)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 34  | `/pitch`                      | 1440  | 1     | 0      | 0         | 0    | 1 (max 63)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 35  | `/demos`                      | 390   | 1     | 0      | 0         | 0    | 1 (max 54)  | 33 / 16.8               | 34 / 33.4                   | 0      | 0      |
| 36  | `/demo/scanner`               | 390   | 1     | 0      | 0         | 0    | 1 (max 77)  | 17 / 16.7               | 17 / 16.7                   | 0.0234 | 0      |
| 37  | `/atlas`                      | 390   | 1     | 0      | 0         | 0    | 1 (max 53)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 38  | `/pricing`                    | 390   | 1     | 0      | 0         | 0    | 1 (max 51)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 39  | `/contact`                    | 390   | 1     | 0      | 0         | 0    | 1 (max 52)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 40  | `/terms`                      | 390   | 1     | 0      | 0         | 0    | 1 (max 53)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 41  | `/docs/api`                   | 390   | 1     | 0      | 0         | 0    | 1 (max 52)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 42  | `/docs`                       | 390   | 1     | 0      | 0         | 0    | 1 (max 52)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 43  | `/docs/security-model`        | 390   | 1     | 0      | 0         | 0    | 1 (max 52)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 44  | `/docs/adapters/edge`         | 390   | 1     | 0      | 0         | 0    | 1 (max 51)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 45  | `/docs/adapters/sdk`          | 390   | 1     | 0      | 0         | 0    | 1 (max 53)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 46  | `/docs/adapters/shield`       | 390   | 1     | 0      | 0         | 0    | 1 (max 51)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 47  | `/docs/adapters/vault`        | 390   | 1     | 0      | 0         | 0    | 1 (max 54)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 48  | `/docs/adapters/web`          | 390   | 1     | 0      | 0         | 0    | 1 (max 51)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 49  | `/docs/concepts`              | 390   | 1     | 0      | 0         | 0    | 1 (max 53)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 50  | `/docs/concepts/sessions`     | 390   | 1     | 0      | 0         | 0    | 1 (max 55)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 51  | `/docs/concepts/signatures`   | 390   | 1     | 0      | 0         | 0    | 1 (max 53)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 52  | `/join`                       | 390   | 1     | 0      | 0         | 0    | 1 (max 53)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 53  | `/pitch`                      | 390   | 1     | 0      | 0         | 0    | 1 (max 63)  | 17 / 16.7               | 17 / 16.7                   | 0.005  | 0      |
| 54  | `/scan/www.irctc.co.in`       | 390   | 1     | 0      | 0         | 0    | 1 (max 52)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 55  | `/atlas/signin`               | 390   | 1     | 0      | 0         | 0    | 1 (max 53)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 56  | `/atlas/demo/detect`          | 390   | 1     | 0      | 0         | 0    | 1 (max 53)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 57  | `/atlas/demo/inventory`       | 390   | 1     | 0      | 0         | 0    | 1 (max 56)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 58  | `/atlas/demo/schedule`        | 390   | 1     | 0      | 0         | 0    | 1 (max 55)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 59  | `/atlas/demo/handshakes`      | 390   | 1     | 0      | 0         | 0    | 1 (max 55)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 60  | `/atlas/demo/qaoa`            | 390   | 1     | 0      | 0         | 0    | 1 (max 56)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 61  | `/atlas/demo/review`          | 390   | 1     | 0      | 0         | 0    | 1 (max 55)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 62  | `/demos`                      | 1440  | 0     | 0      | 0         | 0    | 0           | 33 / 16.8               | 34 / 33.4                   | 0      | 0      |
| 63  | `/demo/scanner`               | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0.0006 | 0      |
| 64  | `/atlas`                      | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 65  | `/pricing`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 66  | `/security`                   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 67  | `/changelog`                  | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 68  | `/contact`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 69  | `/privacy`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 70  | `/terms`                      | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 71  | `/docs/api`                   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 72  | `/docs`                       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 73  | `/docs/security-model`        | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 74  | `/docs/adapters/edge`         | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 75  | `/docs/adapters/sdk`          | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 76  | `/docs/adapters/shield`       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 77  | `/docs/adapters/vault`        | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 78  | `/docs/adapters/web`          | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 79  | `/docs/concepts/hybrid-kem`   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 80  | `/docs/concepts`              | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 81  | `/docs/concepts/key-rotation` | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 82  | `/docs/concepts/sessions`     | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 83  | `/docs/concepts/signatures`   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 84  | `/join`                       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0.0131 | 0      |
| 85  | `/scan/www.irctc.co.in`       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 86  | `/atlas/signin`               | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0.0102 | 0      |
| 87  | `/atlas/demo/detect`          | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0.0111 | 0      |
| 88  | `/atlas/demo/inventory`       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0.0111 | 0      |
| 89  | `/atlas/demo/schedule`        | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0.0111 | 0      |
| 90  | `/atlas/demo/handshakes`      | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0.0111 | 0      |
| 91  | `/atlas/demo/qaoa`            | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0.0111 | 0      |
| 92  | `/atlas/demo/ledger`          | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0.0111 | 0      |
| 93  | `/atlas/demo/review`          | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0.0122 | 0      |
| 94  | `/security`                   | 390   | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 95  | `/changelog`                  | 390   | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 96  | `/privacy`                    | 390   | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 97  | `/docs/concepts/hybrid-kem`   | 390   | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 98  | `/docs/concepts/key-rotation` | 390   | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |

## Details

### `/this-page-does-not-exist` at 390 (score 26)

- console error: Failed to load resource: the server responded with a status of 404 (Not Found)
- long tasks: 52 ms
- failed: /this-page-does-not-exist (HTTP 404)

### `/this-page-does-not-exist` at 1440 (score 25)

- console error: Failed to load resource: the server responded with a status of 404 (Not Found)
- failed: /this-page-does-not-exist (HTTP 404)

### `/` at 1440 (score 11)

- long tasks: 83 ms
- layout shift 0.0067: div.mt-8
- failed: /diagnostics?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)

### `/diagnostics?ws=demo` at 1440 (score 6)

- long tasks: 68 ms
- layout shift 0.0738: div.border.border-line.bg-glass, figcaption.flex.flex-wrap.gap-x-4, h2.text-h2.font-medium.text-fg, p.max-w-text.text-body.text-fg-2, span.absolute.-bottom-px.-right-px

### `/` at 390 (score 4)

- long tasks: 115, 51, 65, 188 ms

### `/diagnostics` at 390 (score 4)

- long tasks: 53, 67, 186, 59 ms
- layout shift 0.0077: div.absolute.bottom-3.left-3, dd.min-w-0.truncate.text-right
- layout shift 0.0073: div.flex.snap-x.snap-mandatory, div.absolute.bottom-3.left-3
- layout shift 0.0069: button.h-8.rounded-sm.border, (text), dd.min-w-0.truncate.text-right
- layout shift 0.0053: button.h-8.rounded-sm.border, button.h-8.rounded-sm.border, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right
- layout shift 0.0045: div.flex.snap-x.snap-mandatory, div.absolute.bottom-3.left-3

### `/solutions` at 390 (score 3)

- long tasks: 75, 73, 169 ms

### `/solutions/fintech` at 390 (score 3)

- long tasks: 62, 85, 176 ms

### `/solutions/healthcare` at 390 (score 3)

- long tasks: 52, 75, 164 ms

### `/solutions/education` at 390 (score 3)

- long tasks: 54, 77, 165 ms

### `/solutions/government` at 390 (score 3)

- long tasks: 54, 78, 167 ms

### `/index` at 390 (score 3)

- long tasks: 52, 78, 184 ms

### `/demo/how-it-works` at 390 (score 3)

- long tasks: 53, 68, 181 ms

### `/demo/deploy` at 390 (score 3)

- long tasks: 54, 78, 166 ms

### `/demo/qday` at 390 (score 3)

- long tasks: 52, 67, 177 ms
- layout shift 0.0096: li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3

### `/demo/ledger` at 390 (score 3)

- long tasks: 53, 65, 179 ms

### `/about` at 390 (score 3)

- long tasks: 52, 75, 163 ms

### `/diagnostics?ws=demo` at 390 (score 3)

- long tasks: 54, 79, 170 ms

### `/platform` at 390 (score 2)

- long tasks: 73, 195 ms

### `/atlas/demo/ledger` at 390 (score 2)

- long tasks: 54, 64 ms

### `/platform` at 1440 (score 1)

- long tasks: 65 ms

### `/solutions` at 1440 (score 1)

- long tasks: 84 ms

### `/solutions/fintech` at 1440 (score 1)

- long tasks: 72 ms

### `/solutions/healthcare` at 1440 (score 1)

- long tasks: 86 ms

### `/solutions/education` at 1440 (score 1)

- long tasks: 68 ms

### `/solutions/government` at 1440 (score 1)

- long tasks: 65 ms

### `/diagnostics` at 1440 (score 1)

- long tasks: 70 ms
- layout shift 0.0017: p.text-fg-2, button.hidden.h-8.rounded-sm, button.h-8.rounded-sm.border, (text), dd.min-w-0.truncate.text-right

### `/index` at 1440 (score 1)

- long tasks: 81 ms

### `/demo/how-it-works` at 1440 (score 1)

- long tasks: 72 ms

### `/demo/deploy` at 1440 (score 1)

- long tasks: 70 ms

### `/demo/qday` at 1440 (score 1)

- long tasks: 72 ms
- layout shift 0.002: li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3

### `/demo/ledger` at 1440 (score 1)

- long tasks: 72 ms
- layout shift 0.0015: div.ml-auto.flex.flex-wrap, div.pr-6.md:border-l.md:border-line, div.pr-6.md:border-l.md:border-line, div.pr-6., div.pr-6.md:border-l.md:border-line

### `/about` at 1440 (score 1)

- long tasks: 78 ms

### `/pitch` at 1440 (score 1)

- long tasks: 63 ms

### `/demos` at 390 (score 1)

- long tasks: 54 ms

### `/demo/scanner` at 390 (score 1)

- long tasks: 77 ms
- layout shift 0.0234: textarea#scan-input.h-stage-sm.w-full.resize-y, div.inline-flex.flex-wrap.rounded-sm

### `/atlas` at 390 (score 1)

- long tasks: 53 ms

### `/pricing` at 390 (score 1)

- long tasks: 51 ms

### `/contact` at 390 (score 1)

- long tasks: 52 ms

### `/terms` at 390 (score 1)

- long tasks: 53 ms

### `/docs/api` at 390 (score 1)

- long tasks: 52 ms

### `/docs` at 390 (score 1)

- long tasks: 52 ms

### `/docs/security-model` at 390 (score 1)

- long tasks: 52 ms

### `/docs/adapters/edge` at 390 (score 1)

- long tasks: 51 ms

### `/docs/adapters/sdk` at 390 (score 1)

- long tasks: 53 ms

### `/docs/adapters/shield` at 390 (score 1)

- long tasks: 51 ms

### `/docs/adapters/vault` at 390 (score 1)

- long tasks: 54 ms

### `/docs/adapters/web` at 390 (score 1)

- long tasks: 51 ms

### `/docs/concepts` at 390 (score 1)

- long tasks: 53 ms

### `/docs/concepts/sessions` at 390 (score 1)

- long tasks: 55 ms

### `/docs/concepts/signatures` at 390 (score 1)

- long tasks: 53 ms

### `/join` at 390 (score 1)

- long tasks: 53 ms

### `/pitch` at 390 (score 1)

- long tasks: 63 ms
- layout shift 0.005: div.col-span-12.animate-reveal.space-y-10

### `/scan/www.irctc.co.in` at 390 (score 1)

- long tasks: 52 ms

### `/atlas/signin` at 390 (score 1)

- long tasks: 53 ms

### `/atlas/demo/detect` at 390 (score 1)

- long tasks: 53 ms

### `/atlas/demo/inventory` at 390 (score 1)

- long tasks: 56 ms

### `/atlas/demo/schedule` at 390 (score 1)

- long tasks: 55 ms

### `/atlas/demo/handshakes` at 390 (score 1)

- long tasks: 55 ms

### `/atlas/demo/qaoa` at 390 (score 1)

- long tasks: 56 ms

### `/atlas/demo/review` at 390 (score 1)

- long tasks: 55 ms
