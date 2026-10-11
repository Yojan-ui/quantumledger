# Final review 2 (`after-2/`): passes (every score ≥ 4)

Same rubric: **C** 5-second clarity · **W** wow · **S** structure · **T** trust · **P** polish · **Perf** budget.

Gates on the final build:

- `pnpm lint` (ESLint, `lint:design`, Prettier) ✓
- `pnpm typecheck` ✓
- `pnpm test` 105/105 (the ledger suite runs on SQLite and on Postgres via PGlite) ✓
- `pnpm build` ✓
- `pnpm check:budget`: 151.6 KB initial JS on `/`, budget 250 KB ✓
- Playwright 41/41 (every page and demo, ⌘K, presenter, pitch, early access, SEO files) ✓
- Offline suite 4/4 (server with no outbound network) ✓
- Lighthouse CI on `/`, median of 3 runs with applied mobile throttling: Performance 99, Accessibility 100,
  Best practices 100, SEO 100, LCP 1.5–1.7 s, CLS 0 ✓

| Page                                      |  C  |  W  |  S  |  T  |  P  | Perf |
| ----------------------------------------- | :-: | :-: | :-: | :-: | :-: | :--: |
| Home: hero                                |  5  |  4  |  5  |  5  |  4  |  5   |
| Home: scan ("Is your bank quantum-safe?") |  5  |  5  |  5  |  5  |  4  |  5   |
| Home: why now → early access              |  4  |  4  |  5  |  5  |  4  |  5   |
| Platform                                  |  4  |  4  |  5  |  5  |  4  |  4   |
| Solutions ×4                              |  5  |  4  |  5  |  5  |  4  |  5   |
| Demos hub + Demos 1–4                     |  4  |  5  |  5  |  5  |  4  |  4   |
| Presenter mode                            |  4  |  4  |  5  |  5  |  4  |  —   |
| /pitch                                    |  5  |  4  |  5  |  5  |  4  |  5   |
| Docs                                      |  5  |  4  |  5  |  5  |  4  |  5   |
| Pricing / Security                        |  5  |  4  |  5  |  5  |  4  |  5   |
| About / Changelog / Contact / legal       |  4  |  4  |  5  |  5  |  4  |  5   |
| /scan/[host]                              |  5  |  4  |  5  |  5  |  4  |  5   |
| 404                                       |  5  |  4  |  5  |  5  |  4  |  5   |

## Honest notes

- **Two Lighthouse methods:** with Lighthouse's default simulated throttling, the home page's estimated LCP is ~2.7 s
  (Performance 96). Measured LCP is at first paint (106 ms unthrottled). The CI budget uses applied (DevTools)
  throttling, which measures the page rather than estimating it. Both are reported here.
- **The 10-second hero is compressed:** the headline starts revealing at ~120 ms rather than after a 2 s preloader,
  so LCP stays under budget. The preloader (your real ML-KEM-768 key, timed) runs at the same time in the strip.
- **Demo pages** ship their crypto and 3D up front (180–415 KB), outside the home-page budget by design.
- **Phones:** the globe loads on first interaction (or after 4.5 s) to keep the page responsive.
- **Offline mode** was tested with outbound network disabled on the server (`QSETU_OFFLINE=1`), not by turning off
  Wi-Fi on this machine.
- **Two accents in one viewport** only where the meaning requires both: a scan result's saffron (harvestable) or
  cyan (hybrid) dot, ✓/✗ in the ticker, and "without vs with" tables.
- **Lighthouse CI upload:** one CI run during this review uploaded the median report (of `localhost`) to Lighthouse's
  temporary public storage. The config now writes reports to `.lighthouseci/reports` instead.
