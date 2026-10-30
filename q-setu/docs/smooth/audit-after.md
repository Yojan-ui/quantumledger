# Glitch audit (after)

`pnpm audit:glitch after` against the production build at http://localhost:3000, 2026-10-30T13:07 UTC.
Every page at 1440×900, and at 390×844 with 4× CPU throttling. Each run: load, scroll to the end, the
page's main action (Play, Verify, Tamper, Scan… or hover across it), 10 s in all. Videos are in
`docs/smooth/videos-after/` (not committed).

## Totals

|                                  | 1440   | 390 (4× CPU) |
| -------------------------------- | ------ | ------------ |
| Console errors + page errors     | 2      | 1            |
| Console warnings                 | 0      | 0            |
| Hydration warnings               | 0      | 0            |
| WebGL driver messages            | 0      | 0            |
| WebGL contexts lost              | 0      | 0            |
| Long tasks > 50 ms               | 15     | 75           |
| Worst frame while scrolling (ms) | 267    | 33           |
| Worst frame in a transition (ms) | 117    | 33           |
| Worst page CLS                   | 0.1886 | 0.0367       |
| Failed requests                  | 31     | 2            |

## Ranked (worst first)

| #   | Page                          | Width | Score | Errors | Hydration | Lost | Long tasks  | Scroll worst / p95 (ms) | Transition worst / p95 (ms) | CLS    | Failed |
| --- | ----------------------------- | ----- | ----- | ------ | --------- | ---- | ----------- | ----------------------- | --------------------------- | ------ | ------ |
| 1   | `/atlas/demo/review`          | 1440  | 98    | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0.1886 | 7      |
| 2   | `/atlas/demo/ledger`          | 1440  | 50    | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0.012  | 5      |
| 3   | `/docs/adapters/edge`         | 1440  | 43    | 0      | 0         | 0    | 0           | 217 / 16.8              | 17 / 16.8                   | 0      | 1      |
| 4   | `/docs/adapters/sdk`          | 1440  | 43    | 0      | 0         | 0    | 0           | 267 / 16.8              | 17 / 16.7                   | 0      | 0      |
| 5   | `/docs/adapters/shield`       | 1440  | 43    | 0      | 0         | 0    | 0           | 267 / 16.7              | 17 / 16.8                   | 0      | 0      |
| 6   | `/atlas/demo/qaoa`            | 1440  | 40    | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0.012  | 4      |
| 7   | `/atlas/demo/inventory`       | 1440  | 30    | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0.012  | 3      |
| 8   | `/this-page-does-not-exist`   | 390   | 26    | 1      | 0         | 0    | 1 (max 83)  | 17 / 16.7               | 17 / 16.8                   | 0      | 1      |
| 9   | `/docs/security-model`        | 1440  | 25    | 1      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 1      |
| 10  | `/this-page-does-not-exist`   | 1440  | 25    | 1      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 1      |
| 11  | `/docs/adapters/web`          | 1440  | 23    | 0      | 0         | 0    | 0           | 17 / 16.7               | 117 / 16.7                  | 0      | 1      |
| 12  | `/atlas/demo/detect`          | 1440  | 20    | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0.012  | 2      |
| 13  | `/atlas/demo/schedule`        | 1440  | 20    | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0.012  | 2      |
| 14  | `/atlas/demo/handshakes`      | 1440  | 20    | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0.012  | 2      |
| 15  | `/docs/adapters/vault`        | 1440  | 13    | 0      | 0         | 0    | 0           | 17 / 16.8               | 117 / 16.8                  | 0      | 0      |
| 16  | `/`                           | 1440  | 11    | 0      | 0         | 0    | 1 (max 86)  | 17 / 16.7               | 17 / 16.7                   | 0.0067 | 1      |
| 17  | `/atlas`                      | 390   | 11    | 0      | 0         | 0    | 1 (max 55)  | 17 / 16.7               | 17 / 16.8                   | 0      | 1      |
| 18  | `/diagnostics?ws=demo`        | 1440  | 10    | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0.0021 | 1      |
| 19  | `/`                           | 390   | 3     | 0      | 0         | 0    | 3 (max 181) | 33 / 16.7               | 17 / 16.7                   | 0.0008 | 0      |
| 20  | `/solutions/fintech`          | 390   | 3     | 0      | 0         | 0    | 3 (max 162) | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 21  | `/solutions/healthcare`       | 390   | 3     | 0      | 0         | 0    | 3 (max 167) | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 22  | `/solutions/education`        | 390   | 3     | 0      | 0         | 0    | 3 (max 183) | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 23  | `/diagnostics`                | 390   | 3     | 0      | 0         | 0    | 3 (max 188) | 17 / 16.8               | 17 / 16.7                   | 0.0367 | 0      |
| 24  | `/index`                      | 390   | 3     | 0      | 0         | 0    | 3 (max 170) | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 25  | `/demo/how-it-works`          | 390   | 3     | 0      | 0         | 0    | 3 (max 204) | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 26  | `/demo/deploy`                | 390   | 3     | 0      | 0         | 0    | 3 (max 169) | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 27  | `/demo/qday`                  | 390   | 3     | 0      | 0         | 0    | 3 (max 212) | 17 / 16.7               | 17 / 16.7                   | 0.0098 | 0      |
| 28  | `/demo/ledger`                | 390   | 3     | 0      | 0         | 0    | 3 (max 177) | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 29  | `/about`                      | 390   | 3     | 0      | 0         | 0    | 3 (max 170) | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 30  | `/platform`                   | 390   | 2     | 0      | 0         | 0    | 2 (max 165) | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 31  | `/solutions`                  | 390   | 2     | 0      | 0         | 0    | 2 (max 165) | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 32  | `/solutions/government`       | 390   | 2     | 0      | 0         | 0    | 2 (max 170) | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 33  | `/atlas/demo/ledger`          | 390   | 2     | 0      | 0         | 0    | 2 (max 66)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 34  | `/platform`                   | 1440  | 1     | 0      | 0         | 0    | 1 (max 70)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 35  | `/solutions`                  | 1440  | 1     | 0      | 0         | 0    | 1 (max 81)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 36  | `/solutions/fintech`          | 1440  | 1     | 0      | 0         | 0    | 1 (max 73)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 37  | `/solutions/healthcare`       | 1440  | 1     | 0      | 0         | 0    | 1 (max 75)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 38  | `/solutions/education`        | 1440  | 1     | 0      | 0         | 0    | 1 (max 84)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 39  | `/solutions/government`       | 1440  | 1     | 0      | 0         | 0    | 1 (max 86)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 40  | `/diagnostics`                | 1440  | 1     | 0      | 0         | 0    | 1 (max 69)  | 17 / 16.7               | 17 / 16.8                   | 0.004  | 0      |
| 41  | `/index`                      | 1440  | 1     | 0      | 0         | 0    | 1 (max 94)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 42  | `/demo/how-it-works`          | 1440  | 1     | 0      | 0         | 0    | 1 (max 69)  | 17 / 16.8               | 17 / 16.7                   | 0.0013 | 0      |
| 43  | `/demo/deploy`                | 1440  | 1     | 0      | 0         | 0    | 1 (max 67)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 44  | `/demo/qday`                  | 1440  | 1     | 0      | 0         | 0    | 1 (max 70)  | 17 / 16.7               | 17 / 16.8                   | 0.002  | 0      |
| 45  | `/demo/ledger`                | 1440  | 1     | 0      | 0         | 0    | 1 (max 71)  | 17 / 16.7               | 17 / 16.7                   | 0.0001 | 0      |
| 46  | `/about`                      | 1440  | 1     | 0      | 0         | 0    | 1 (max 96)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 47  | `/pitch`                      | 1440  | 1     | 0      | 0         | 0    | 1 (max 67)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 48  | `/demos`                      | 390   | 1     | 0      | 0         | 0    | 1 (max 51)  | 33 / 16.8               | 33 / 33.4                   | 0      | 0      |
| 49  | `/demo/scanner`               | 390   | 1     | 0      | 0         | 0    | 1 (max 82)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 50  | `/pricing`                    | 390   | 1     | 0      | 0         | 0    | 1 (max 55)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 51  | `/security`                   | 390   | 1     | 0      | 0         | 0    | 1 (max 53)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 52  | `/changelog`                  | 390   | 1     | 0      | 0         | 0    | 1 (max 58)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 53  | `/contact`                    | 390   | 1     | 0      | 0         | 0    | 1 (max 54)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 54  | `/privacy`                    | 390   | 1     | 0      | 0         | 0    | 1 (max 54)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 55  | `/terms`                      | 390   | 1     | 0      | 0         | 0    | 1 (max 52)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 56  | `/docs/api`                   | 390   | 1     | 0      | 0         | 0    | 1 (max 53)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 57  | `/docs`                       | 390   | 1     | 0      | 0         | 0    | 1 (max 54)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 58  | `/docs/security-model`        | 390   | 1     | 0      | 0         | 0    | 1 (max 52)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 59  | `/docs/adapters/edge`         | 390   | 1     | 0      | 0         | 0    | 1 (max 54)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 60  | `/docs/adapters/sdk`          | 390   | 1     | 0      | 0         | 0    | 1 (max 77)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 61  | `/docs/adapters/shield`       | 390   | 1     | 0      | 0         | 0    | 1 (max 79)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 62  | `/docs/adapters/vault`        | 390   | 1     | 0      | 0         | 0    | 1 (max 55)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 63  | `/docs/adapters/web`          | 390   | 1     | 0      | 0         | 0    | 1 (max 81)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 64  | `/docs/concepts/hybrid-kem`   | 390   | 1     | 0      | 0         | 0    | 1 (max 53)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 65  | `/docs/concepts`              | 390   | 1     | 0      | 0         | 0    | 1 (max 54)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 66  | `/docs/concepts/key-rotation` | 390   | 1     | 0      | 0         | 0    | 1 (max 53)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 67  | `/docs/concepts/sessions`     | 390   | 1     | 0      | 0         | 0    | 1 (max 52)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 68  | `/docs/concepts/signatures`   | 390   | 1     | 0      | 0         | 0    | 1 (max 53)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 69  | `/join`                       | 390   | 1     | 0      | 0         | 0    | 1 (max 53)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 70  | `/pitch`                      | 390   | 1     | 0      | 0         | 0    | 1 (max 55)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 71  | `/scan/www.irctc.co.in`       | 390   | 1     | 0      | 0         | 0    | 1 (max 53)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 72  | `/atlas/signin`               | 390   | 1     | 0      | 0         | 0    | 1 (max 54)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 73  | `/atlas/demo/detect`          | 390   | 1     | 0      | 0         | 0    | 1 (max 55)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 74  | `/atlas/demo/inventory`       | 390   | 1     | 0      | 0         | 0    | 1 (max 57)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 75  | `/atlas/demo/schedule`        | 390   | 1     | 0      | 0         | 0    | 1 (max 56)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 76  | `/atlas/demo/handshakes`      | 390   | 1     | 0      | 0         | 0    | 1 (max 55)  | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 77  | `/atlas/demo/qaoa`            | 390   | 1     | 0      | 0         | 0    | 1 (max 54)  | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 78  | `/atlas/demo/review`          | 390   | 1     | 0      | 0         | 0    | 1 (max 55)  | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 79  | `/diagnostics?ws=demo`        | 390   | 1     | 0      | 0         | 0    | 1 (max 54)  | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 80  | `/demos`                      | 1440  | 0     | 0      | 0         | 0    | 0           | 33 / 16.8               | 34 / 33.4                   | 0      | 0      |
| 81  | `/demo/scanner`               | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0.0006 | 0      |
| 82  | `/atlas`                      | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 83  | `/pricing`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 84  | `/security`                   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 85  | `/changelog`                  | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 86  | `/contact`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 87  | `/privacy`                    | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 88  | `/terms`                      | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0      | 0      |
| 89  | `/docs/api`                   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 90  | `/docs`                       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 91  | `/docs/concepts/hybrid-kem`   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 92  | `/docs/concepts`              | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 93  | `/docs/concepts/key-rotation` | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0      | 0      |
| 94  | `/docs/concepts/sessions`     | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 95  | `/docs/concepts/signatures`   | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.7                   | 0      | 0      |
| 96  | `/join`                       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.8               | 17 / 16.8                   | 0.0131 | 0      |
| 97  | `/scan/www.irctc.co.in`       | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.7                   | 0      | 0      |
| 98  | `/atlas/signin`               | 1440  | 0     | 0      | 0         | 0    | 0           | 17 / 16.7               | 17 / 16.8                   | 0.0102 | 0      |

## Details

### `/atlas/demo/review` at 1440 (score 98)

- layout shift 0.1886: div.mt-2, footer.border-t.border-line.py-24
- failed: /diagnostics?ws=demo&_rsc=SiYP3ixV7HPrBHVr (net::ERR_ABORTED)
- failed: /atlas/demo/detect?_rsc=SiYP3ixV7HPrBHVr (net::ERR_ABORTED)
- failed: /atlas/demo/inventory?_rsc=SiYP3ixV7HPrBHVr (net::ERR_ABORTED)
- failed: /atlas/demo/schedule?_rsc=SiYP3ixV7HPrBHVr (net::ERR_ABORTED)
- failed: /atlas/demo/handshakes?_rsc=SiYP3ixV7HPrBHVr (net::ERR_ABORTED)
- failed: /atlas/demo/qaoa?_rsc=SiYP3ixV7HPrBHVr (net::ERR_ABORTED)
- failed: /atlas/demo/ledger?_rsc=SiYP3ixV7HPrBHVr (net::ERR_ABORTED)

### `/atlas/demo/ledger` at 1440 (score 50)

- layout shift 0.012: div.mt-2
- failed: /diagnostics?ws=demo&_rsc=Al8eD0HdRpw42R0G (net::ERR_ABORTED)
- failed: /atlas/demo/schedule?_rsc=Al8eD0HdRpw42R0G (net::ERR_ABORTED)
- failed: /atlas/demo/handshakes?_rsc=Al8eD0HdRpw42R0G (net::ERR_ABORTED)
- failed: /atlas/demo/qaoa?_rsc=Al8eD0HdRpw42R0G (net::ERR_ABORTED)
- failed: /atlas/demo/review?_rsc=Al8eD0HdRpw42R0G (net::ERR_ABORTED)

### `/docs/adapters/edge` at 1440 (score 43)

- failed: /api/health (net::ERR_ABORTED)

### `/docs/adapters/sdk` at 1440 (score 43)

### `/docs/adapters/shield` at 1440 (score 43)

### `/atlas/demo/qaoa` at 1440 (score 40)

- layout shift 0.012: div.mt-2
- failed: /atlas/demo/schedule?_rsc=ErpK5vpoSibqY9ln (net::ERR_ABORTED)
- failed: /atlas/demo/handshakes?_rsc=ErpK5vpoSibqY9ln (net::ERR_ABORTED)
- failed: /atlas/demo/ledger?_rsc=ErpK5vpoSibqY9ln (net::ERR_ABORTED)
- failed: /atlas/demo/review?_rsc=ErpK5vpoSibqY9ln (net::ERR_ABORTED)

### `/atlas/demo/inventory` at 1440 (score 30)

- layout shift 0.012: div.mt-2
- failed: /atlas/demo/handshakes?_rsc=IcE9CRnQtdYi6G_8 (net::ERR_ABORTED)
- failed: /atlas/demo/qaoa?_rsc=IcE9CRnQtdYi6G_8 (net::ERR_ABORTED)
- failed: /atlas/demo/ledger?_rsc=IcE9CRnQtdYi6G_8 (net::ERR_ABORTED)

### `/this-page-does-not-exist` at 390 (score 26)

- console error: Failed to load resource: the server responded with a status of 404 (Not Found)
- long tasks: 83 ms
- failed: /this-page-does-not-exist (HTTP 404)

### `/docs/security-model` at 1440 (score 25)

- console error: Failed to load resource: net::ERR_NETWORK_IO_SUSPENDED
- failed: /api/stream (net::ERR_NETWORK_IO_SUSPENDED)

### `/this-page-does-not-exist` at 1440 (score 25)

- console error: Failed to load resource: the server responded with a status of 404 (Not Found)
- failed: /this-page-does-not-exist (HTTP 404)

### `/docs/adapters/web` at 1440 (score 23)

- failed: /api/health (net::ERR_ABORTED)

### `/atlas/demo/detect` at 1440 (score 20)

- layout shift 0.012: div.mt-2
- failed: /atlas/demo/ledger?_rsc=2229zRO30Q_9pk_U (net::ERR_ABORTED)
- failed: /atlas/demo/review?_rsc=2229zRO30Q_9pk_U (net::ERR_ABORTED)

### `/atlas/demo/schedule` at 1440 (score 20)

- layout shift 0.012: div.mt-2
- failed: /atlas/demo/detect?_rsc=1e6dY6cbVIROLeSw (net::ERR_ABORTED)
- failed: /atlas/demo/inventory?_rsc=1e6dY6cbVIROLeSw (net::ERR_ABORTED)

### `/atlas/demo/handshakes` at 1440 (score 20)

- layout shift 0.012: div.mt-2
- failed: /atlas/demo/review?_rsc=DeOqnPaPOjE2tzrd (net::ERR_ABORTED)
- failed: /atlas/demo/ledger?_rsc=DeOqnPaPOjE2tzrd (net::ERR_ABORTED)

### `/docs/adapters/vault` at 1440 (score 13)

### `/` at 1440 (score 11)

- long tasks: 86 ms
- layout shift 0.0067: div.mt-8
- failed: /diagnostics?_rsc=1p-R_iEY6bj0jY31 (net::ERR_ABORTED)

### `/atlas` at 390 (score 11)

- long tasks: 55 ms
- failed: /atlas/demo/detect?_rsc=bv_x9VAy-PHi0oAm (net::ERR_ABORTED)

### `/diagnostics?ws=demo` at 1440 (score 10)

- layout shift 0.0021: div.border.border-line.bg-glass, span.absolute.-bottom-px.-left-px, span.absolute.-bottom-px.-right-px, span.absolute.-bottom-px.-left-px, span.absolute.-bottom-px.-right-px
- failed: /atlas/demo/detect?_rsc=5uLgBCEKVAcDC1CS (net::ERR_ABORTED)

### `/` at 390 (score 3)

- long tasks: 112, 67, 181 ms

### `/solutions/fintech` at 390 (score 3)

- long tasks: 75, 74, 162 ms

### `/solutions/healthcare` at 390 (score 3)

- long tasks: 57, 77, 167 ms

### `/solutions/education` at 390 (score 3)

- long tasks: 51, 74, 183 ms

### `/diagnostics` at 390 (score 3)

- long tasks: 52, 67, 188 ms
- layout shift 0.0134: div.absolute.bottom-3.left-3, button.h-8.rounded-sm.border, button.h-8.rounded-sm.border, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right
- layout shift 0.0073: div.flex.snap-x.snap-mandatory, div.absolute.bottom-3.left-3
- layout shift 0.0069: button.h-8.rounded-sm.border, (text), dd.min-w-0.truncate.text-right
- layout shift 0.0045: div.flex.snap-x.snap-mandatory, div.absolute.bottom-3.left-3
- layout shift 0.0021: dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, dd.min-w-0.truncate.text-right, (text)

### `/index` at 390 (score 3)

- long tasks: 54, 76, 170 ms

### `/demo/how-it-works` at 390 (score 3)

- long tasks: 62, 73, 204 ms

### `/demo/deploy` at 390 (score 3)

- long tasks: 53, 79, 169 ms

### `/demo/qday` at 390 (score 3)

- long tasks: 63, 72, 212 ms
- layout shift 0.0096: li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3

### `/demo/ledger` at 390 (score 3)

- long tasks: 60, 69, 177 ms

### `/about` at 390 (score 3)

- long tasks: 54, 78, 170 ms

### `/platform` at 390 (score 2)

- long tasks: 76, 165 ms

### `/solutions` at 390 (score 2)

- long tasks: 73, 165 ms

### `/solutions/government` at 390 (score 2)

- long tasks: 75, 170 ms

### `/atlas/demo/ledger` at 390 (score 2)

- long tasks: 54, 66 ms

### `/platform` at 1440 (score 1)

- long tasks: 70 ms

### `/solutions` at 1440 (score 1)

- long tasks: 81 ms

### `/solutions/fintech` at 1440 (score 1)

- long tasks: 73 ms

### `/solutions/healthcare` at 1440 (score 1)

- long tasks: 75 ms

### `/solutions/education` at 1440 (score 1)

- long tasks: 84 ms

### `/solutions/government` at 1440 (score 1)

- long tasks: 86 ms

### `/diagnostics` at 1440 (score 1)

- long tasks: 69 ms
- layout shift 0.0017: p.text-fg-2, button.hidden.h-8.rounded-sm, button.h-8.rounded-sm.border, (text), dd.min-w-0.truncate.text-right

### `/index` at 1440 (score 1)

- long tasks: 94 ms

### `/demo/how-it-works` at 1440 (score 1)

- long tasks: 69 ms

### `/demo/deploy` at 1440 (score 1)

- long tasks: 67 ms

### `/demo/qday` at 1440 (score 1)

- long tasks: 70 ms
- layout shift 0.002: li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3, li.flex.items-center.gap-3

### `/demo/ledger` at 1440 (score 1)

- long tasks: 71 ms

### `/about` at 1440 (score 1)

- long tasks: 96 ms

### `/pitch` at 1440 (score 1)

- long tasks: 67 ms

### `/demos` at 390 (score 1)

- long tasks: 51 ms

### `/demo/scanner` at 390 (score 1)

- long tasks: 82 ms

### `/pricing` at 390 (score 1)

- long tasks: 55 ms

### `/security` at 390 (score 1)

- long tasks: 53 ms

### `/changelog` at 390 (score 1)

- long tasks: 58 ms

### `/contact` at 390 (score 1)

- long tasks: 54 ms

### `/privacy` at 390 (score 1)

- long tasks: 54 ms

### `/terms` at 390 (score 1)

- long tasks: 52 ms

### `/docs/api` at 390 (score 1)

- long tasks: 53 ms

### `/docs` at 390 (score 1)

- long tasks: 54 ms

### `/docs/security-model` at 390 (score 1)

- long tasks: 52 ms

### `/docs/adapters/edge` at 390 (score 1)

- long tasks: 54 ms

### `/docs/adapters/sdk` at 390 (score 1)

- long tasks: 77 ms

### `/docs/adapters/shield` at 390 (score 1)

- long tasks: 79 ms

### `/docs/adapters/vault` at 390 (score 1)

- long tasks: 55 ms

### `/docs/adapters/web` at 390 (score 1)

- long tasks: 81 ms

### `/docs/concepts/hybrid-kem` at 390 (score 1)

- long tasks: 53 ms

### `/docs/concepts` at 390 (score 1)

- long tasks: 54 ms

### `/docs/concepts/key-rotation` at 390 (score 1)

- long tasks: 53 ms

### `/docs/concepts/sessions` at 390 (score 1)

- long tasks: 52 ms

### `/docs/concepts/signatures` at 390 (score 1)

- long tasks: 53 ms

### `/join` at 390 (score 1)

- long tasks: 53 ms

### `/pitch` at 390 (score 1)

- long tasks: 55 ms

### `/scan/www.irctc.co.in` at 390 (score 1)

- long tasks: 53 ms

### `/atlas/signin` at 390 (score 1)

- long tasks: 54 ms

### `/atlas/demo/detect` at 390 (score 1)

- long tasks: 55 ms

### `/atlas/demo/inventory` at 390 (score 1)

- long tasks: 57 ms

### `/atlas/demo/schedule` at 390 (score 1)

- long tasks: 56 ms

### `/atlas/demo/handshakes` at 390 (score 1)

- long tasks: 55 ms

### `/atlas/demo/qaoa` at 390 (score 1)

- long tasks: 54 ms

### `/atlas/demo/review` at 390 (score 1)

- long tasks: 55 ms

### `/diagnostics?ws=demo` at 390 (score 1)

- long tasks: 54 ms
