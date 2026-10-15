# Glitch audit (after-1)

`pnpm audit:glitch after-1` against the production build at http://localhost:3000, 2026-10-15T13:05 UTC.
Every page at 1440×900, and at 390×844 with 4× CPU throttling. Each run: load, scroll to the end, the
page's main action (Play, Verify, Tamper, Scan… or hover across it), 10 s in all. Videos are in
`docs/motion2/videos-after-1/` (not committed).

## Totals

|                                  | 1440  | 390 (4× CPU) |
| -------------------------------- | ----- | ------------ |
| Console errors + page errors     | 3     | 1            |
| Console warnings                 | 0     | 0            |
| Hydration warnings               | 0     | 0            |
| WebGL driver messages            | 0     | 0            |
| WebGL contexts lost              | 0     | 0            |
| Long tasks > 50 ms               | 15    | 108          |
| Worst frame while scrolling (ms) | 283   | 33           |
| Worst frame in a transition (ms) | 83    | 34           |
| Worst page CLS                   | 0.019 | 0.0936       |
| Failed requests                  | 848   | 257          |

## Ranked (worst first)

| #   | Page                          | Width | Score | Errors | Hydration | Lost | Long tasks  | Scroll worst / p95 (ms) | Transition worst / p95 (ms) | CLS    | Failed |
| --- | ----------------------------- | ----- | ----- | ------ | --------- | ---- | ----------- | ----------------------- | --------------------------- | ------ | ------ |
| 1   | `/this-page-does-not-exist`   | 1440  | 322   | 1      | 0         | 0    | 0           | 283 / 16.8              | 17 / 16.8                   | 0      | 26     |
| 2   | `/docs`                       | 1440  | 310   | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 31     |
| 3   | `/docs/adapters/edge`         | 1440  | 300   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 30     |
| 4   | `/docs/concepts`              | 1440  | 290   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 29     |
| 5   | `/docs/concepts/key-rotation` | 1440  | 290   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 29     |
| 6   | `/docs/concepts/sessions`     | 1440  | 290   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 29     |
| 7   | `/docs/concepts/signatures`   | 1440  | 290   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 29     |
| 8   | `/docs/adapters/sdk`          | 1440  | 280   | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 28     |
| 9   | `/docs/concepts/hybrid-kem`   | 1440  | 280   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 28     |
| 10  | `/shield`                     | 1440  | 270   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 27     |
| 11  | `/docs/api`                   | 1440  | 270   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 27     |
| 12  | `/docs/adapters/vault`        | 1440  | 270   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 27     |
| 13  | `/scan/www.irctc.co.in`       | 1440  | 265   | 1      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 25     |
| 14  | `/shield/live`                | 1440  | 260   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 26     |
| 15  | `/docs/security-model`        | 1440  | 260   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 26     |
| 16  | `/platform`                   | 1440  | 258   | 0      | 0         | 0    | 1 (max 76)  | 17 / 16.8               | 83 / 16.8                   | 0      | 25     |
| 17  | `/docs/adapters/shield`       | 1440  | 250   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 25     |
| 18  | `/docs/adapters/web`          | 1440  | 250   | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 25     |
| 19  | `/privacy`                    | 1440  | 245   | 1      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 23     |
| 20  | `/`                           | 1440  | 241   | 0      | 0         | 0    | 1 (max 106) | 17 / 16.7               | 17 / 16.8                   | 0.0033 | 24     |
| 21  | `/terms`                      | 1440  | 240   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 24     |
| 22  | `/solutions/government`       | 1440  | 231   | 0      | 0         | 0    | 1 (max 82)  | 17 / 16.7               | 17 / 16.8                   | 0      | 23     |
| 23  | `/solutions`                  | 1440  | 221   | 0      | 0         | 0    | 1 (max 77)  | 50 / 16.7               | 17 / 16.7                   | 0      | 22     |
| 24  | `/solutions/education`        | 1440  | 221   | 0      | 0         | 0    | 1 (max 90)  | 17 / 16.7               | 17 / 16.7                   | 0      | 22     |
| 25  | `/demos`                      | 1440  | 220   | 0      | 0         | 0    | 0           | 33 / 16.8               | 34 / 33.4                   | 0      | 22     |
| 26  | `/about`                      | 1440  | 211   | 0      | 0         | 0    | 1 (max 91)  | 17 / 16.8               | 17 / 16.7                   | 0      | 21     |
| 27  | `/pricing`                    | 1440  | 210   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 21     |
| 28  | `/security`                   | 1440  | 210   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 21     |
| 29  | `/contact`                    | 1440  | 210   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 21     |
| 30  | `/solutions/healthcare`       | 1440  | 201   | 0      | 0         | 0    | 1 (max 92)  | 17 / 16.8               | 17 / 16.8                   | 0      | 20     |
| 31  | `/solutions/fintech`          | 1440  | 181   | 0      | 0         | 0    | 1 (max 103) | 17 / 16.8               | 17 / 16.8                   | 0      | 18     |
| 32  | `/index`                      | 1440  | 181   | 0      | 0         | 0    | 1 (max 95)  | 17 / 16.7               | 17 / 16.8                   | 0      | 18     |
| 33  | `/docs/api`                   | 390   | 162   | 0      | 0         | 0    | 2 (max 133) | 17 / 16.7               | 17 / 16.7                   | 0      | 16     |
| 34  | `/changelog`                  | 1440  | 150   | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 15     |
| 35  | `/docs/concepts/hybrid-kem`   | 390   | 143   | 0      | 0         | 0    | 3 (max 214) | 17 / 16.7               | 17 / 16.7                   | 0      | 14     |
| 36  | `/docs/concepts/signatures`   | 390   | 142   | 0      | 0         | 0    | 2 (max 198) | 17 / 16.8               | 17 / 16.7                   | 0      | 14     |
| 37  | `/docs`                       | 390   | 122   | 0      | 0         | 0    | 2 (max 126) | 17 / 16.7               | 33 / 16.8                   | 0      | 12     |
| 38  | `/docs/adapters/edge`         | 390   | 122   | 0      | 0         | 0    | 2 (max 126) | 17 / 16.7               | 17 / 16.7                   | 0      | 12     |
| 39  | `/docs/adapters/vault`        | 390   | 122   | 0      | 0         | 0    | 2 (max 139) | 17 / 16.7               | 17 / 16.7                   | 0      | 12     |
| 40  | `/docs/adapters/web`          | 390   | 122   | 0      | 0         | 0    | 2 (max 150) | 17 / 16.8               | 33 / 16.8                   | 0      | 12     |
| 41  | `/docs/adapters/shield`       | 390   | 112   | 0      | 0         | 0    | 2 (max 137) | 17 / 16.7               | 17 / 16.7                   | 0      | 11     |
| 42  | `/docs/concepts/sessions`     | 390   | 112   | 0      | 0         | 0    | 2 (max 202) | 17 / 16.7               | 17 / 16.8                   | 0      | 11     |
| 43  | `/docs/concepts`              | 390   | 102   | 0      | 0         | 0    | 2 (max 199) | 17 / 16.7               | 17 / 16.7                   | 0      | 10     |
| 44  | `/scan/www.irctc.co.in`       | 390   | 94    | 0      | 0         | 0    | 4 (max 270) | 17 / 16.8               | 17 / 16.7                   | 0      | 9      |
| 45  | `/docs/adapters/sdk`          | 390   | 92    | 0      | 0         | 0    | 2 (max 140) | 17 / 16.7               | 17 / 16.8                   | 0      | 9      |
| 46  | `/shield/live`                | 390   | 82    | 0      | 0         | 0    | 2 (max 121) | 17 / 16.7               | 17 / 16.8                   | 0      | 8      |
| 47  | `/this-page-does-not-exist`   | 390   | 77    | 1      | 0         | 0    | 2 (max 197) | 17 / 16.7               | 17 / 16.7                   | 0      | 6      |
| 48  | `/docs/concepts/key-rotation` | 390   | 73    | 0      | 0         | 0    | 3 (max 334) | 17 / 16.8               | 17 / 16.8                   | 0      | 7      |
| 49  | `/contact`                    | 390   | 72    | 0      | 0         | 0    | 2 (max 127) | 17 / 16.7               | 17 / 16.7                   | 0      | 7      |
| 50  | `/docs/security-model`        | 390   | 72    | 0      | 0         | 0    | 2 (max 140) | 17 / 16.7               | 17 / 16.8                   | 0      | 7      |
| 51  | `/diagnostics`                | 1440  | 61    | 0      | 0         | 0    | 1 (max 76)  | 17 / 16.7               | 17 / 16.8                   | 0.0043 | 6      |
| 52  | `/demo/how-it-works`          | 1440  | 61    | 0      | 0         | 0    | 1 (max 78)  | 17 / 16.7               | 17 / 16.7                   | 0.008  | 6      |
| 53  | `/demo/deploy`                | 1440  | 61    | 0      | 0         | 0    | 1 (max 78)  | 17 / 16.7               | 17 / 16.8                   | 0      | 6      |
| 54  | `/demo/scanner`               | 1440  | 60    | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0.0003 | 6      |
| 55  | `/index`                      | 390   | 53    | 0      | 0         | 0    | 3 (max 196) | 17 / 16.8               | 17 / 16.7                   | 0      | 5      |
| 56  | `/security`                   | 390   | 52    | 0      | 0         | 0    | 2 (max 128) | 17 / 16.8               | 17 / 16.7                   | 0      | 5      |
| 57  | `/demo/ledger`                | 1440  | 51    | 0      | 0         | 0    | 1 (max 77)  | 17 / 16.8               | 17 / 16.7                   | 0.0083 | 5      |
| 58  | `/pitch`                      | 1440  | 51    | 0      | 0         | 0    | 1 (max 78)  | 17 / 16.7               | 17 / 16.7                   | 0      | 5      |
| 59  | `/join`                       | 1440  | 50    | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0.0132 | 5      |
| 60  | `/diagnostics`                | 390   | 47    | 0      | 0         | 0    | 7 (max 415) | 17 / 16.8               | 17 / 16.8                   | 0.0236 | 4      |
| 61  | `/demo/how-it-works`          | 390   | 44    | 0      | 0         | 0    | 4 (max 210) | 17 / 16.7               | 17 / 16.7                   | 0.0059 | 4      |
| 62  | `/solutions`                  | 390   | 43    | 0      | 0         | 0    | 3 (max 196) | 17 / 16.8               | 17 / 16.7                   | 0      | 4      |
| 63  | `/solutions/healthcare`       | 390   | 43    | 0      | 0         | 0    | 3 (max 189) | 17 / 16.7               | 17 / 16.8                   | 0      | 4      |
| 64  | `/solutions/government`       | 390   | 43    | 0      | 0         | 0    | 3 (max 193) | 17 / 16.7               | 17 / 16.7                   | 0      | 4      |
| 65  | `/pitch`                      | 390   | 43    | 0      | 0         | 0    | 3 (max 227) | 17 / 16.8               | 17 / 16.8                   | 0      | 4      |
| 66  | `/shield`                     | 390   | 42    | 0      | 0         | 0    | 2 (max 117) | 17 / 16.8               | 17 / 16.7                   | 0      | 4      |
| 67  | `/demos`                      | 390   | 42    | 0      | 0         | 0    | 2 (max 224) | 17 / 16.8               | 34 / 33.4                   | 0      | 4      |
| 68  | `/privacy`                    | 390   | 42    | 0      | 0         | 0    | 2 (max 126) | 17 / 16.8               | 17 / 16.8                   | 0      | 4      |
| 69  | `/terms`                      | 390   | 42    | 0      | 0         | 0    | 2 (max 133) | 17 / 16.7               | 17 / 16.7                   | 0      | 4      |
| 70  | `/`                           | 390   | 34    | 0      | 0         | 0    | 4 (max 200) | 33 / 16.8               | 17 / 16.8                   | 0.0059 | 3      |
| 71  | `/platform`                   | 390   | 33    | 0      | 0         | 0    | 3 (max 187) | 17 / 16.7               | 17 / 16.7                   | 0      | 3      |
| 72  | `/solutions/fintech`          | 390   | 33    | 0      | 0         | 0    | 3 (max 192) | 17 / 16.8               | 17 / 16.7                   | 0      | 3      |
| 73  | `/solutions/education`        | 390   | 33    | 0      | 0         | 0    | 3 (max 195) | 17 / 16.8               | 17 / 16.7                   | 0      | 3      |
| 74  | `/demo/deploy`                | 390   | 33    | 0      | 0         | 0    | 3 (max 211) | 17 / 16.7               | 17 / 16.8                   | 0      | 3      |
| 75  | `/about`                      | 390   | 33    | 0      | 0         | 0    | 3 (max 212) | 17 / 16.8               | 17 / 16.7                   | 0      | 3      |
| 76  | `/demo/scanner`               | 390   | 32    | 0      | 0         | 0    | 2 (max 161) | 17 / 16.8               | 17 / 16.8                   | 0.0238 | 3      |
| 77  | `/pricing`                    | 390   | 32    | 0      | 0         | 0    | 2 (max 132) | 17 / 16.7               | 17 / 16.8                   | 0      | 3      |
| 78  | `/changelog`                  | 390   | 32    | 0      | 0         | 0    | 2 (max 165) | 17 / 16.8               | 17 / 16.7                   | 0      | 3      |
| 79  | `/demo/ledger`                | 390   | 23    | 0      | 0         | 0    | 3 (max 276) | 17 / 16.8               | 17 / 16.8                   | 0      | 2      |
| 80  | `/join`                       | 390   | 22    | 0      | 0         | 0    | 3 (max 219) | 17 / 16.8               | 17 / 16.7                   | 0.0936 | 1      |
| 81  | `/demo/qday`                  | 1440  | 21    | 0      | 0         | 0    | 1 (max 78)  | 17 / 16.8               | 17 / 16.8                   | 0.019  | 2      |
| 82  | `/demo/qday`                  | 390   | 3     | 0      | 0         | 0    | 3 (max 280) | 17 / 16.8               | 17 / 16.7                   | 0.0158 | 0      |

## Details

### `/this-page-does-not-exist` at 1440 (score 322)

- console error: Failed to load resource: the server responded with a status of 404 (Not Found)
- failed: /this-page-does-not-exist (HTTP 404)
- failed: /?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /shield?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /platform?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /solutions?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /demos?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /docs?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /pricing?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /changelog?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /docs/api?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /security?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /contact?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /about?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /privacy?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /terms?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=gP-dKIzQhcdxdKSx (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=gP-dKIzQhcdxdKSx (net::ERR_ABORTED)
- failed: /index?_rsc=gP-dKIzQhcdxdKSx (net::ERR_ABORTED)
- failed: /join?_rsc=gP-dKIzQhcdxdKSx (net::ERR_ABORTED)
- failed: /api/health (net::ERR_ABORTED)

### `/docs` at 1440 (score 310)

- failed: /?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /platform?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /shield?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /solutions?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /demos?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /pricing?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/api?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=-yZNePjRDOH8dHa4 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=-yZNePjRDOH8dHa4 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=-yZNePjRDOH8dHa4 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=-yZNePjRDOH8dHa4 (net::ERR_ABORTED)
- failed: /join?_rsc=-yZNePjRDOH8dHa4 (net::ERR_ABORTED)
- failed: /index?_rsc=-yZNePjRDOH8dHa4 (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /about?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /security?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /contact?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)

### `/docs/adapters/edge` at 1440 (score 300)

- failed: /?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /platform?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /shield?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /solutions?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /demos?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /pricing?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/api?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=wkvWoIQEw9j83LrQ (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=wkvWoIQEw9j83LrQ (net::ERR_ABORTED)
- failed: /join?_rsc=wkvWoIQEw9j83LrQ (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /security?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /contact?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /changelog?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /privacy?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /terms?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)

### `/docs/concepts` at 1440 (score 290)

- failed: /?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /platform?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /shield?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /solutions?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /demos?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /pricing?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/api?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /changelog?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /about?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /security?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /contact?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=XhJMm7VSZ5zT8J-b (net::ERR_ABORTED)
- failed: /join?_rsc=XhJMm7VSZ5zT8J-b (net::ERR_ABORTED)
- failed: /index?_rsc=XhJMm7VSZ5zT8J-b (net::ERR_ABORTED)

### `/docs/concepts/key-rotation` at 1440 (score 290)

- failed: /demos?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /platform?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /solutions?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /pricing?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/api?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /changelog?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /about?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /security?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /contact?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /privacy?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=6_yHZT3Tb5PdBHUG (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=6_yHZT3Tb5PdBHUG (net::ERR_ABORTED)

### `/docs/concepts/sessions` at 1440 (score 290)

- failed: /?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /platform?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /shield?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /demos?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /solutions?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /pricing?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/api?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /about?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /security?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /contact?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /privacy?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=-z7zyCPbfJKqBtEY (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=-z7zyCPbfJKqBtEY (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=-z7zyCPbfJKqBtEY (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=-z7zyCPbfJKqBtEY (net::ERR_ABORTED)
- failed: /index?_rsc=-z7zyCPbfJKqBtEY (net::ERR_ABORTED)
- failed: /join?_rsc=-z7zyCPbfJKqBtEY (net::ERR_ABORTED)

### `/docs/concepts/signatures` at 1440 (score 290)

- failed: /?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /platform?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /shield?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /solutions?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /demos?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /pricing?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/api?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /changelog?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /privacy?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=7bVME0r6j-Fvcmtf (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=7bVME0r6j-Fvcmtf (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=7bVME0r6j-Fvcmtf (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=7bVME0r6j-Fvcmtf (net::ERR_ABORTED)
- failed: /index?_rsc=7bVME0r6j-Fvcmtf (net::ERR_ABORTED)
- failed: /join?_rsc=7bVME0r6j-Fvcmtf (net::ERR_ABORTED)

### `/docs/adapters/sdk` at 1440 (score 280)

- failed: /?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /shield?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /platform?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /solutions?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /pricing?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/api?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=xiFmjObillsgkiqD (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=xiFmjObillsgkiqD (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=xiFmjObillsgkiqD (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=xiFmjObillsgkiqD (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /security?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /contact?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /changelog?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /privacy?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)

### `/docs/concepts/hybrid-kem` at 1440 (score 280)

- failed: /platform?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /shield?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /solutions?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /pricing?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/api?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /changelog?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /privacy?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=7xDt0A_MVBf5rktZ (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=7xDt0A_MVBf5rktZ (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=7xDt0A_MVBf5rktZ (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=7xDt0A_MVBf5rktZ (net::ERR_ABORTED)
- failed: /join?_rsc=7xDt0A_MVBf5rktZ (net::ERR_ABORTED)
- failed: /index?_rsc=7xDt0A_MVBf5rktZ (net::ERR_ABORTED)

### `/shield` at 1440 (score 270)

- failed: /?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /platform?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /solutions?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /demos?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /docs?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /pricing?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /app?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /shield/live?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=Cl5qVxdK7x_EkJZi (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=Cl5qVxdK7x_EkJZi (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=Cl5qVxdK7x_EkJZi (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=Cl5qVxdK7x_EkJZi (net::ERR_ABORTED)
- failed: /index?_rsc=Cl5qVxdK7x_EkJZi (net::ERR_ABORTED)
- failed: /join?_rsc=Cl5qVxdK7x_EkJZi (net::ERR_ABORTED)
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
- failed: /terms?_rsc=1wEsswCW_yeBmKfp (net::ERR_ABORTED)

### `/docs/api` at 1440 (score 270)

- failed: /?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /platform?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /shield?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /demos?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /solutions?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /pricing?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=ZEGLIF8C-3DXSnI0 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=ZEGLIF8C-3DXSnI0 (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=ZEGLIF8C-3DXSnI0 (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /about?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /security?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /contact?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)

### `/docs/adapters/vault` at 1440 (score 270)

- failed: /platform?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /solutions?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /demos?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /pricing?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/api?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=kv9lsddgBKhJD5rs (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=kv9lsddgBKhJD5rs (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=kv9lsddgBKhJD5rs (net::ERR_ABORTED)
- failed: /index?_rsc=kv9lsddgBKhJD5rs (net::ERR_ABORTED)
- failed: /join?_rsc=kv9lsddgBKhJD5rs (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /changelog?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /privacy?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)

### `/scan/www.irctc.co.in` at 1440 (score 265)

- console error: Failed to load resource: net::ERR_NETWORK_IO_SUSPENDED
- failed: /?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /platform?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /shield?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /demos?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /solutions?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /pricing?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /docs?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=omhYoygxHSoetFhJ (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=omhYoygxHSoetFhJ (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=omhYoygxHSoetFhJ (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=omhYoygxHSoetFhJ (net::ERR_ABORTED)
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
- failed: /api/stream (net::ERR_NETWORK_IO_SUSPENDED)

### `/shield/live` at 1440 (score 260)

- failed: /?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /platform?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /shield?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /solutions?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /demos?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /docs?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /pricing?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /about?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /security?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=qf1TO_W2Uutzm343 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=qf1TO_W2Uutzm343 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=qf1TO_W2Uutzm343 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=qf1TO_W2Uutzm343 (net::ERR_ABORTED)
- failed: /index?_rsc=qf1TO_W2Uutzm343 (net::ERR_ABORTED)
- failed: /join?_rsc=qf1TO_W2Uutzm343 (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /docs/api?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /contact?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /changelog?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /privacy?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /terms?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)

### `/docs/security-model` at 1440 (score 260)

- failed: /?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /platform?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /shield?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /solutions?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /demos?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /pricing?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/api?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=qKiOHNskj0JCCwW5 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=qKiOHNskj0JCCwW5 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=qKiOHNskj0JCCwW5 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=qKiOHNskj0JCCwW5 (net::ERR_ABORTED)
- failed: /index?_rsc=qKiOHNskj0JCCwW5 (net::ERR_ABORTED)
- failed: /join?_rsc=qKiOHNskj0JCCwW5 (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /contact?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /changelog?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /privacy?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)

### `/platform` at 1440 (score 258)

- long tasks: 76 ms
- failed: /?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /shield?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /solutions?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /demos?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /docs?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /pricing?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=igG17uxtuZnTNGU2 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=igG17uxtuZnTNGU2 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=igG17uxtuZnTNGU2 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=igG17uxtuZnTNGU2 (net::ERR_ABORTED)
- failed: /index?_rsc=igG17uxtuZnTNGU2 (net::ERR_ABORTED)
- failed: /join?_rsc=igG17uxtuZnTNGU2 (net::ERR_ABORTED)
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
- failed: /terms?_rsc=4RbsUTmCTnNodW50 (net::ERR_ABORTED)

### `/docs/adapters/shield` at 1440 (score 250)

- failed: /?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /platform?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /shield?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /demos?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /pricing?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/api?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=n8f0dZreNMTPCDj2 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=n8f0dZreNMTPCDj2 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=n8f0dZreNMTPCDj2 (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=n8f0dZreNMTPCDj2 (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /changelog?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /privacy?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)

### `/docs/adapters/web` at 1440 (score 250)

- failed: /?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /shield?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /solutions?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /demos?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /pricing?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
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

### `/privacy` at 1440 (score 245)

- console error: Failed to load resource: net::ERR_NETWORK_IO_SUSPENDED
- failed: /?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /platform?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /shield?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /solutions?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /demos?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /docs?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /pricing?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=hWY7gX7Gns5i7uOm (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=hWY7gX7Gns5i7uOm (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=hWY7gX7Gns5i7uOm (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=hWY7gX7Gns5i7uOm (net::ERR_ABORTED)
- failed: /index?_rsc=hWY7gX7Gns5i7uOm (net::ERR_ABORTED)
- failed: /join?_rsc=hWY7gX7Gns5i7uOm (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /security?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /docs/api?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /contact?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /changelog?_rsc=rwu5VT28ZerHQs0v (net::ERR_ABORTED)
- failed: /api/stream (net::ERR_NETWORK_IO_SUSPENDED)

### `/` at 1440 (score 241)

- long tasks: 106 ms
- layout shift 0.0023: div.mt-8
- failed: /platform?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /shield?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /solutions?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /demos?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /docs?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /pricing?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /diagnostics?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=ZmCQ44b92m4mXe_R (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=ZmCQ44b92m4mXe_R (net::ERR_ABORTED)
- failed: /join?_rsc=ZmCQ44b92m4mXe_R (net::ERR_ABORTED)
- failed: /index?_rsc=ZmCQ44b92m4mXe_R (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /docs/api?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /about?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /security?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /contact?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /changelog?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /terms?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)
- failed: /privacy?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)

### `/terms` at 1440 (score 240)

- failed: /platform?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /shield?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /solutions?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /demos?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /docs?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /pricing?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=PVgkf2z9MJ5DB4vO (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=PVgkf2z9MJ5DB4vO (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=PVgkf2z9MJ5DB4vO (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=PVgkf2z9MJ5DB4vO (net::ERR_ABORTED)
- failed: /index?_rsc=PVgkf2z9MJ5DB4vO (net::ERR_ABORTED)
- failed: /join?_rsc=PVgkf2z9MJ5DB4vO (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=DNFl5fs2IjKQRqXM (net::ERR_ABORTED)
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

### `/solutions/government` at 1440 (score 231)

- long tasks: 82 ms
- failed: /platform?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /solutions?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /shield?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /demos?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /docs?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /pricing?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=uqhsyBNQ7mioKwOT (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=uqhsyBNQ7mioKwOT (net::ERR_ABORTED)
- failed: /join?_rsc=uqhsyBNQ7mioKwOT (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=uqhsyBNQ7mioKwOT (net::ERR_ABORTED)
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
- failed: /terms?_rsc=hrbEPuy2OQrrqYy6 (net::ERR_ABORTED)

### `/solutions` at 1440 (score 221)

- long tasks: 77 ms
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
- failed: /demo/qday?_rsc=OORq0xsJAT4Ux3pG (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=OORq0xsJAT4Ux3pG (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=OORq0xsJAT4Ux3pG (net::ERR_ABORTED)
- failed: /join?_rsc=OORq0xsJAT4Ux3pG (net::ERR_ABORTED)
- failed: /index?_rsc=OORq0xsJAT4Ux3pG (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)
- failed: /docs/api?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)
- failed: /contact?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)
- failed: /changelog?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)
- failed: /privacy?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)
- failed: /terms?_rsc=dakuujLrL6N7y_yt (net::ERR_ABORTED)

### `/solutions/education` at 1440 (score 221)

- long tasks: 90 ms
- failed: /?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /shield?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /platform?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /solutions?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /demos?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /pricing?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /docs?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=zkRnjQUQJYniuD5_ (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=zkRnjQUQJYniuD5_ (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=zkRnjQUQJYniuD5_ (net::ERR_ABORTED)
- failed: /join?_rsc=zkRnjQUQJYniuD5_ (net::ERR_ABORTED)
- failed: /index?_rsc=zkRnjQUQJYniuD5_ (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=zkRnjQUQJYniuD5_ (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /docs/api?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /changelog?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)
- failed: /privacy?_rsc=Jadk1AE5QIYc9RdH (net::ERR_ABORTED)

### `/demos` at 1440 (score 220)

- failed: /?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /platform?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /shield?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /solutions?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /docs?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /pricing?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=v0d3kxW6pJe8X4cc (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=v0d3kxW6pJe8X4cc (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=v0d3kxW6pJe8X4cc (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=v0d3kxW6pJe8X4cc (net::ERR_ABORTED)
- failed: /index?_rsc=v0d3kxW6pJe8X4cc (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /about?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /security?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /docs/api?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /contact?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /changelog?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /privacy?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=Jf_cbMjXKcBw7QMQ (net::ERR_ABORTED)

### `/about` at 1440 (score 211)

- long tasks: 91 ms
- failed: /?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /shield?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /platform?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /demos?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /docs?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /pricing?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=kL8YMqvKhVCpUJei (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=kL8YMqvKhVCpUJei (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=kL8YMqvKhVCpUJei (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=kL8YMqvKhVCpUJei (net::ERR_ABORTED)
- failed: /index?_rsc=kL8YMqvKhVCpUJei (net::ERR_ABORTED)
- failed: /join?_rsc=kL8YMqvKhVCpUJei (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /security?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /docs/api?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /changelog?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)
- failed: /privacy?_rsc=_paE49VugaXyxB1G (net::ERR_ABORTED)

### `/pricing` at 1440 (score 210)

- failed: /?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /platform?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /shield?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /solutions?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /demos?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /contact?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /docs?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=mf32xbX59GT2m-y9 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=mf32xbX59GT2m-y9 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=mf32xbX59GT2m-y9 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=mf32xbX59GT2m-y9 (net::ERR_ABORTED)
- failed: /index?_rsc=mf32xbX59GT2m-y9 (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /security?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /docs/api?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /changelog?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)
- failed: /privacy?_rsc=yrzGVZEURCHTUGxG (net::ERR_ABORTED)

### `/security` at 1440 (score 210)

- failed: /?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /platform?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /shield?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /solutions?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /demos?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /docs?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /pricing?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=YyJpiOpUMgxYTgWR (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=YyJpiOpUMgxYTgWR (net::ERR_ABORTED)
- failed: /index?_rsc=YyJpiOpUMgxYTgWR (net::ERR_ABORTED)
- failed: /join?_rsc=YyJpiOpUMgxYTgWR (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /docs/api?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /contact?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /changelog?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)
- failed: /privacy?_rsc=lNyNOyqLeBrCcjRN (net::ERR_ABORTED)

### `/contact` at 1440 (score 210)

- failed: /?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /platform?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /shield?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /solutions?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /demos?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /pricing?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /docs?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=HqxYgmTx6NZNLxiF (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=HqxYgmTx6NZNLxiF (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=HqxYgmTx6NZNLxiF (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=HqxYgmTx6NZNLxiF (net::ERR_ABORTED)
- failed: /index?_rsc=HqxYgmTx6NZNLxiF (net::ERR_ABORTED)
- failed: /join?_rsc=HqxYgmTx6NZNLxiF (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /about?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /security?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /docs/api?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)

### `/solutions/healthcare` at 1440 (score 201)

- long tasks: 92 ms
- failed: /?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /platform?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /shield?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /demos?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /docs?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /pricing?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=Bt4bAK-uhjfiVdYp (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=Bt4bAK-uhjfiVdYp (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=Bt4bAK-uhjfiVdYp (net::ERR_ABORTED)
- failed: /join?_rsc=Bt4bAK-uhjfiVdYp (net::ERR_ABORTED)
- failed: /index?_rsc=Bt4bAK-uhjfiVdYp (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /solutions/education?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /docs/api?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /contact?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /changelog?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)
- failed: /privacy?_rsc=LVXhpXTeImHILPPC (net::ERR_ABORTED)

### `/solutions/fintech` at 1440 (score 181)

- long tasks: 103 ms
- failed: /?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /platform?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /shield?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /solutions?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /demos?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /docs?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /pricing?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=1s1cDpN3PerCYgd4 (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=1s1cDpN3PerCYgd4 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=1s1cDpN3PerCYgd4 (net::ERR_ABORTED)
- failed: /join?_rsc=1s1cDpN3PerCYgd4 (net::ERR_ABORTED)
- failed: /index?_rsc=1s1cDpN3PerCYgd4 (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /security?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)
- failed: /changelog?_rsc=IZbjg0DerzkZ-Fj5 (net::ERR_ABORTED)

### `/index` at 1440 (score 181)

- long tasks: 95 ms
- failed: /shield?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /solutions?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /platform?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /docs?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /pricing?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=li3HOL36sEipfFMQ (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=li3HOL36sEipfFMQ (net::ERR_ABORTED)
- failed: /join?_rsc=li3HOL36sEipfFMQ (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=li3HOL36sEipfFMQ (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=li3HOL36sEipfFMQ (net::ERR_ABORTED)
- failed: /solutions/fintech?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /security?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /changelog?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)
- failed: /privacy?_rsc=_gTsEsVXdPB9twQu (net::ERR_ABORTED)

### `/docs/api` at 390 (score 162)

- long tasks: 59, 133 ms
- failed: /?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=-XNKPIF-pp59HNTb (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=ZEGLIF8C-3DXSnI0 (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=ZEGLIF8C-3DXSnI0 (net::ERR_ABORTED)
- failed: /join?_rsc=ZEGLIF8C-3DXSnI0 (net::ERR_ABORTED)

### `/changelog` at 1440 (score 150)

- failed: /?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /platform?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /demos?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /solutions?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /docs?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /pricing?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=YcWaCux-N8fbPgQB (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=YcWaCux-N8fbPgQB (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=YcWaCux-N8fbPgQB (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=YcWaCux-N8fbPgQB (net::ERR_ABORTED)
- failed: /index?_rsc=YcWaCux-N8fbPgQB (net::ERR_ABORTED)
- failed: /join?_rsc=YcWaCux-N8fbPgQB (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /solutions/healthcare?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)
- failed: /solutions/government?_rsc=wzdoXYREmoMA9dfK (net::ERR_ABORTED)

### `/docs/concepts/hybrid-kem` at 390 (score 143)

- long tasks: 60, 90, 214 ms
- failed: /?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/api?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=gqGTFSTsulNNLLgj (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=7xDt0A_MVBf5rktZ (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=7xDt0A_MVBf5rktZ (net::ERR_ABORTED)
- failed: /index?_rsc=7xDt0A_MVBf5rktZ (net::ERR_ABORTED)

### `/docs/concepts/signatures` at 390 (score 142)

- long tasks: 90, 198 ms
- failed: /docs?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/api?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=7bVME0r6j-Fvcmtf (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=7bVME0r6j-Fvcmtf (net::ERR_ABORTED)
- failed: /pricing?_rsc=khOlON73OxRI5Y2k (net::ERR_ABORTED)

### `/docs` at 390 (score 122)

- long tasks: 57, 126 ms
- failed: /?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/api?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=mOOM5CVjrHYor5c0 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=-yZNePjRDOH8dHa4 (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=-yZNePjRDOH8dHa4 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=-yZNePjRDOH8dHa4 (net::ERR_ABORTED)

### `/docs/adapters/edge` at 390 (score 122)

- long tasks: 58, 126 ms
- failed: /?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/api?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=WD6m8JxCZODu4c8E (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=wkvWoIQEw9j83LrQ (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=wkvWoIQEw9j83LrQ (net::ERR_ABORTED)

### `/docs/adapters/vault` at 390 (score 122)

- long tasks: 58, 139 ms
- failed: /?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/api?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=kv9lsddgBKhJD5rs (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=kv9lsddgBKhJD5rs (net::ERR_ABORTED)
- failed: /index?_rsc=kv9lsddgBKhJD5rs (net::ERR_ABORTED)
- failed: /pricing?_rsc=1jfxpR2Zi_uAEwDm (net::ERR_ABORTED)

### `/docs/adapters/web` at 390 (score 122)

- long tasks: 64, 150 ms
- failed: /?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/adapters/sdk?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /docs/api?_rsc=BBL8WKlfLAiV_t0U (net::ERR_ABORTED)
- failed: /index?_rsc=XftLZ3UCnnNkeN9O (net::ERR_ABORTED)

### `/docs/adapters/shield` at 390 (score 112)

- long tasks: 59, 137 ms
- failed: /?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/adapters/web?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /docs/api?_rsc=567VnnVyoS7TtiLK (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=n8f0dZreNMTPCDj2 (net::ERR_ABORTED)

### `/docs/concepts/sessions` at 390 (score 112)

- long tasks: 89, 202 ms
- failed: /?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/adapters/edge?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/api?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=-z7zyCPbfJKqBtEY (net::ERR_ABORTED)
- failed: /platform?_rsc=NOTXi-IqyABhXujR (net::ERR_ABORTED)

### `/docs/concepts` at 390 (score 102)

- long tasks: 88, 199 ms
- failed: /?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/api?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /pricing?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)
- failed: /changelog?_rsc=EESBW6h5xnrddwAd (net::ERR_ABORTED)

### `/scan/www.irctc.co.in` at 390 (score 94)

- long tasks: 59, 119, 63, 270 ms
- failed: /demo/how-it-works?_rsc=omhYoygxHSoetFhJ (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=omhYoygxHSoetFhJ (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=omhYoygxHSoetFhJ (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=omhYoygxHSoetFhJ (net::ERR_ABORTED)
- failed: /pricing?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /changelog?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /docs/api?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)
- failed: /demos?_rsc=FP8iid7NPS2Otlbx (net::ERR_ABORTED)

### `/docs/adapters/sdk` at 390 (score 92)

- long tasks: 60, 140 ms
- failed: /docs/adapters/vault?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/concepts/hybrid-kem?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/concepts/signatures?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/api?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /docs/security-model?_rsc=j4lQJqjKtAVasEwn (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=xiFmjObillsgkiqD (net::ERR_ABORTED)
- failed: /index?_rsc=xiFmjObillsgkiqD (net::ERR_ABORTED)

### `/shield/live` at 390 (score 82)

- long tasks: 53, 121 ms
- failed: /demo/deploy?_rsc=qf1TO_W2Uutzm343 (net::ERR_ABORTED)
- failed: /index?_rsc=qf1TO_W2Uutzm343 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=qf1TO_W2Uutzm343 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=qf1TO_W2Uutzm343 (net::ERR_ABORTED)
- failed: /changelog?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /docs/adapters/shield?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /security?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)
- failed: /demos?_rsc=soh_8Rj2uyTDXI7T (net::ERR_ABORTED)

### `/this-page-does-not-exist` at 390 (score 77)

- console error: Failed to load resource: the server responded with a status of 404 (Not Found)
- long tasks: 90, 197 ms
- failed: /this-page-does-not-exist (HTTP 404)
- failed: /?_rsc=0JRbJX4JgpfuvHsr (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=gP-dKIzQhcdxdKSx (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=gP-dKIzQhcdxdKSx (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=gP-dKIzQhcdxdKSx (net::ERR_ABORTED)
- failed: /index?_rsc=gP-dKIzQhcdxdKSx (net::ERR_ABORTED)

### `/docs/concepts/key-rotation` at 390 (score 73)

- long tasks: 137, 65, 334 ms
- failed: /docs/adapters/edge?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /docs/concepts/sessions?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=6_yHZT3Tb5PdBHUG (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=6_yHZT3Tb5PdBHUG (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=6_yHZT3Tb5PdBHUG (net::ERR_ABORTED)
- failed: /platform?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)
- failed: /pricing?_rsc=G8tipOl4ncPBQSUy (net::ERR_ABORTED)

### `/contact` at 390 (score 72)

- long tasks: 58, 127 ms
- failed: /demo/deploy?_rsc=HqxYgmTx6NZNLxiF (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=HqxYgmTx6NZNLxiF (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=HqxYgmTx6NZNLxiF (net::ERR_ABORTED)
- failed: /index?_rsc=HqxYgmTx6NZNLxiF (net::ERR_ABORTED)
- failed: /platform?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /demo/scanner?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)
- failed: /changelog?_rsc=8k6vkql5ktX3Dkf2 (net::ERR_ABORTED)

### `/docs/security-model` at 390 (score 72)

- long tasks: 59, 140 ms
- failed: /docs/adapters/edge?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/concepts?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/adapters/vault?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/concepts/key-rotation?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /docs/api?_rsc=ejw0jUwc8VnsHoWA (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=qKiOHNskj0JCCwW5 (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=qKiOHNskj0JCCwW5 (net::ERR_ABORTED)

### `/diagnostics` at 1440 (score 61)

- long tasks: 76 ms
- layout shift 0.0017: p.text-fg-2, button.hidden.h-8.rounded-sm, button.h-8.rounded-sm.border, (text), dd.min-w-0.truncate.text-right
- failed: /?_rsc=5uLgBCEKVAcDC1CS (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=X1OHO8Wm4TCDMONl (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=X1OHO8Wm4TCDMONl (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=X1OHO8Wm4TCDMONl (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=X1OHO8Wm4TCDMONl (net::ERR_ABORTED)
- failed: /index?_rsc=X1OHO8Wm4TCDMONl (net::ERR_ABORTED)

### `/demo/how-it-works` at 1440 (score 61)

- long tasks: 78 ms
- layout shift 0.007: div.pointer-events-none.absolute.inset-x-0, div.pr-6.md:border-l.md:border-line, div.pr-6.md:border-l.md:border-line, div.pr-6.md:border-l.md:border-line, div.pr-6.md:border-l.md:border-line
- failed: /demos?_rsc=wZyECymZZ2VIot9Z (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=CVhrOiiOx8uuK5BS (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=CVhrOiiOx8uuK5BS (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=CVhrOiiOx8uuK5BS (net::ERR_ABORTED)
- failed: /join?_rsc=CVhrOiiOx8uuK5BS (net::ERR_ABORTED)
- failed: /index?_rsc=CVhrOiiOx8uuK5BS (net::ERR_ABORTED)

### `/demo/deploy` at 1440 (score 61)

- long tasks: 78 ms
- failed: /demos?_rsc=kqn8NtDtrZ53EOk8 (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=HAx0ck6KAccnSpQw (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=HAx0ck6KAccnSpQw (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=HAx0ck6KAccnSpQw (net::ERR_ABORTED)
- failed: /index?_rsc=HAx0ck6KAccnSpQw (net::ERR_ABORTED)
- failed: /join?_rsc=HAx0ck6KAccnSpQw (net::ERR_ABORTED)

### `/demo/scanner` at 1440 (score 60)

- failed: /demos?_rsc=cFioy5qGKfabZFhF (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=XOdE9CWIKECMXNsK (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=XOdE9CWIKECMXNsK (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=XOdE9CWIKECMXNsK (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=XOdE9CWIKECMXNsK (net::ERR_ABORTED)
- failed: /index?_rsc=XOdE9CWIKECMXNsK (net::ERR_ABORTED)

### `/index` at 390 (score 53)

- long tasks: 54, 96, 196 ms
- failed: /demo/how-it-works?_rsc=li3HOL36sEipfFMQ (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=li3HOL36sEipfFMQ (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=li3HOL36sEipfFMQ (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=li3HOL36sEipfFMQ (net::ERR_ABORTED)
- failed: /join?_rsc=li3HOL36sEipfFMQ (net::ERR_ABORTED)

### `/security` at 390 (score 52)

- long tasks: 58, 128 ms
- failed: /demo/how-it-works?_rsc=YyJpiOpUMgxYTgWR (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=YyJpiOpUMgxYTgWR (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=YyJpiOpUMgxYTgWR (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=YyJpiOpUMgxYTgWR (net::ERR_ABORTED)
- failed: /index?_rsc=YyJpiOpUMgxYTgWR (net::ERR_ABORTED)

### `/demo/ledger` at 1440 (score 51)

- long tasks: 77 ms
- layout shift 0.0033: div.ml-auto.flex.flex-wrap, div.pr-6.md:border-l.md:border-line, div.pr-6.md:border-l.md:border-line, div.pr-6.md:border-l.md:border-line, div.pr-6.md:border-l.md:border-line
- failed: /demos?_rsc=qePgz_B-wUDGm_7C (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=r_APt36-VFXudRiP (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=r_APt36-VFXudRiP (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=r_APt36-VFXudRiP (net::ERR_ABORTED)
- failed: /index?_rsc=r_APt36-VFXudRiP (net::ERR_ABORTED)

### `/pitch` at 1440 (score 51)

- long tasks: 78 ms
- failed: /demo/ledger?_rsc=MyG8qYdSY3bNpC4n (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=MyG8qYdSY3bNpC4n (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=MyG8qYdSY3bNpC4n (net::ERR_ABORTED)
- failed: /index?_rsc=MyG8qYdSY3bNpC4n (net::ERR_ABORTED)
- failed: /join?_rsc=MyG8qYdSY3bNpC4n (net::ERR_ABORTED)

### `/join` at 1440 (score 50)

- layout shift 0.0132: fieldset.mt-8, ::after.
- failed: /?_rsc=ZKT-nziZdQWI1pvG (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=a87G1evOvoS83bya (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=a87G1evOvoS83bya (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=a87G1evOvoS83bya (net::ERR_ABORTED)
- failed: /index?_rsc=a87G1evOvoS83bya (net::ERR_ABORTED)

### `/diagnostics` at 390 (score 47)

- long tasks: 52, 93, 131, 92, 415, 66, 73 ms
- layout shift 0.0077: div.absolute.bottom-3.left-3, dd.min-w-0.truncate.text-right
- layout shift 0.0076: button.h-8.rounded-sm.border, (text), dd.min-w-0.truncate.text-right
- layout shift 0.005: button.h-8.rounded-sm.border, button.h-8.rounded-sm.border, dd.min-w-0.truncate.text-right, (text), dd.min-w-0.truncate.text-right
- layout shift 0.0019: dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, (text), dd.min-w-0.truncate.text-right
- layout shift 0.0013: div.absolute.bottom-3.left-3
- failed: /demo/deploy?_rsc=X1OHO8Wm4TCDMONl (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=X1OHO8Wm4TCDMONl (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=X1OHO8Wm4TCDMONl (net::ERR_ABORTED)
- failed: /index?_rsc=X1OHO8Wm4TCDMONl (net::ERR_ABORTED)

### `/demo/how-it-works` at 390 (score 44)

- long tasks: 57, 73, 56, 210 ms
- layout shift 0.0059: div.pointer-events-none.absolute.inset-x-0
- failed: /demo/qday?_rsc=CVhrOiiOx8uuK5BS (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=CVhrOiiOx8uuK5BS (net::ERR_ABORTED)
- failed: /index?_rsc=CVhrOiiOx8uuK5BS (net::ERR_ABORTED)
- failed: /join?_rsc=CVhrOiiOx8uuK5BS (net::ERR_ABORTED)

### `/solutions` at 390 (score 43)

- long tasks: 52, 115, 196 ms
- failed: /demo/deploy?_rsc=OORq0xsJAT4Ux3pG (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=OORq0xsJAT4Ux3pG (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=OORq0xsJAT4Ux3pG (net::ERR_ABORTED)
- failed: /index?_rsc=OORq0xsJAT4Ux3pG (net::ERR_ABORTED)

### `/solutions/healthcare` at 390 (score 43)

- long tasks: 54, 117, 189 ms
- failed: /demo/deploy?_rsc=Bt4bAK-uhjfiVdYp (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=Bt4bAK-uhjfiVdYp (net::ERR_ABORTED)
- failed: /index?_rsc=Bt4bAK-uhjfiVdYp (net::ERR_ABORTED)
- failed: /join?_rsc=Bt4bAK-uhjfiVdYp (net::ERR_ABORTED)

### `/solutions/government` at 390 (score 43)

- long tasks: 53, 118, 193 ms
- failed: /demo/how-it-works?_rsc=uqhsyBNQ7mioKwOT (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=uqhsyBNQ7mioKwOT (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=uqhsyBNQ7mioKwOT (net::ERR_ABORTED)
- failed: /index?_rsc=uqhsyBNQ7mioKwOT (net::ERR_ABORTED)

### `/pitch` at 390 (score 43)

- long tasks: 111, 79, 227 ms
- failed: /demo/deploy?_rsc=MyG8qYdSY3bNpC4n (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=MyG8qYdSY3bNpC4n (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=MyG8qYdSY3bNpC4n (net::ERR_ABORTED)
- failed: /index?_rsc=MyG8qYdSY3bNpC4n (net::ERR_ABORTED)

### `/shield` at 390 (score 42)

- long tasks: 51, 117 ms
- failed: /demo/qday?_rsc=Cl5qVxdK7x_EkJZi (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=Cl5qVxdK7x_EkJZi (net::ERR_ABORTED)
- failed: /index?_rsc=Cl5qVxdK7x_EkJZi (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=Cl5qVxdK7x_EkJZi (net::ERR_ABORTED)

### `/demos` at 390 (score 42)

- long tasks: 96, 224 ms
- failed: /demo/how-it-works?_rsc=v0d3kxW6pJe8X4cc (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=v0d3kxW6pJe8X4cc (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=v0d3kxW6pJe8X4cc (net::ERR_ABORTED)
- failed: /index?_rsc=v0d3kxW6pJe8X4cc (net::ERR_ABORTED)

### `/privacy` at 390 (score 42)

- long tasks: 57, 126 ms
- failed: /demo/deploy?_rsc=hWY7gX7Gns5i7uOm (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=hWY7gX7Gns5i7uOm (net::ERR_ABORTED)
- failed: /index?_rsc=hWY7gX7Gns5i7uOm (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=hWY7gX7Gns5i7uOm (net::ERR_ABORTED)

### `/terms` at 390 (score 42)

- long tasks: 60, 133 ms
- failed: /demo/deploy?_rsc=PVgkf2z9MJ5DB4vO (net::ERR_ABORTED)
- failed: /index?_rsc=PVgkf2z9MJ5DB4vO (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=PVgkf2z9MJ5DB4vO (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=PVgkf2z9MJ5DB4vO (net::ERR_ABORTED)

### `/` at 390 (score 34)

- long tasks: 108, 56, 68, 200 ms
- layout shift 0.0054: div.absolute.right-5.top-6
- failed: /demo/how-it-works?_rsc=ZmCQ44b92m4mXe_R (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=ZmCQ44b92m4mXe_R (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=ZmCQ44b92m4mXe_R (net::ERR_ABORTED)

### `/platform` at 390 (score 33)

- long tasks: 54, 99, 187 ms
- failed: /demo/how-it-works?_rsc=igG17uxtuZnTNGU2 (net::ERR_ABORTED)
- failed: /demo/deploy?_rsc=igG17uxtuZnTNGU2 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=igG17uxtuZnTNGU2 (net::ERR_ABORTED)

### `/solutions/fintech` at 390 (score 33)

- long tasks: 53, 119, 192 ms
- failed: /demo/qday?_rsc=1s1cDpN3PerCYgd4 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=1s1cDpN3PerCYgd4 (net::ERR_ABORTED)
- failed: /index?_rsc=1s1cDpN3PerCYgd4 (net::ERR_ABORTED)

### `/solutions/education` at 390 (score 33)

- long tasks: 52, 119, 195 ms
- failed: /demo/qday?_rsc=zkRnjQUQJYniuD5_ (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=zkRnjQUQJYniuD5_ (net::ERR_ABORTED)
- failed: /index?_rsc=zkRnjQUQJYniuD5_ (net::ERR_ABORTED)

### `/demo/deploy` at 390 (score 33)

- long tasks: 61, 165, 211 ms
- failed: /demo/qday?_rsc=HAx0ck6KAccnSpQw (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=HAx0ck6KAccnSpQw (net::ERR_ABORTED)
- failed: /index?_rsc=HAx0ck6KAccnSpQw (net::ERR_ABORTED)

### `/about` at 390 (score 33)

- long tasks: 58, 128, 212 ms
- failed: /demo/deploy?_rsc=kL8YMqvKhVCpUJei (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=kL8YMqvKhVCpUJei (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=kL8YMqvKhVCpUJei (net::ERR_ABORTED)

### `/demo/scanner` at 390 (score 32)

- long tasks: 72, 161 ms
- layout shift 0.0238: textarea#scan-input.h-stage-sm.w-full.resize-y, div.inline-flex.flex-wrap.rounded-sm
- failed: /demo/deploy?_rsc=XOdE9CWIKECMXNsK (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=XOdE9CWIKECMXNsK (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=XOdE9CWIKECMXNsK (net::ERR_ABORTED)

### `/pricing` at 390 (score 32)

- long tasks: 57, 132 ms
- failed: /demo/deploy?_rsc=mf32xbX59GT2m-y9 (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=mf32xbX59GT2m-y9 (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=mf32xbX59GT2m-y9 (net::ERR_ABORTED)

### `/changelog` at 390 (score 32)

- long tasks: 73, 165 ms
- failed: /demo/deploy?_rsc=YcWaCux-N8fbPgQB (net::ERR_ABORTED)
- failed: /demo/qday?_rsc=YcWaCux-N8fbPgQB (net::ERR_ABORTED)
- failed: /demo/ledger?_rsc=YcWaCux-N8fbPgQB (net::ERR_ABORTED)

### `/demo/ledger` at 390 (score 23)

- long tasks: 64, 88, 276 ms
- failed: /demo/qday?_rsc=r_APt36-VFXudRiP (net::ERR_ABORTED)
- failed: /index?_rsc=r_APt36-VFXudRiP (net::ERR_ABORTED)

### `/join` at 390 (score 22)

- long tasks: 74, 91, 219 ms
- layout shift 0.0936: fieldset.mt-8
- failed: /demo/qday?_rsc=a87G1evOvoS83bya (net::ERR_ABORTED)

### `/demo/qday` at 1440 (score 21)

- long tasks: 78 ms
- layout shift 0.0122: div.pointer-events-none.absolute.inset-x-0
- layout shift 0.003: li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3
- failed: /demos?_rsc=fkENv3RCJmSH95Zg (net::ERR_ABORTED)
- failed: /demo/how-it-works?_rsc=WVgpNe78MT_28VeH (net::ERR_ABORTED)

### `/demo/qday` at 390 (score 3)

- long tasks: 81, 110, 280 ms
- layout shift 0.0096: li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3
- layout shift 0.0059: div.pointer-events-none.absolute.inset-x-0
