# Final review 1 (`after-1/`)

Captures: every page at 1440×900 (`desktop-*`, plus `*-full.png` full-page) and 390×844 (`mobile-*`), and
`scroll-30s.webm`. Lighthouse (home, mobile, applied throttling, median of 3): Performance 99, Accessibility
100, Best practices 100, SEO 100; LCP 1.7 s, CLS 0, TBT 50 ms; initial JS 149 KB gzip.

Scores 1–5: **C** 5-second clarity · **W** wow · **S** structure (one question per section) · **T** trust (every
number real or cited, nothing fake) · **P** polish · **Perf** budget.

**5-second clarity from the hero screenshot alone:** "QuantumLedger adds post-quantum encryption to any system in India
in one line; this page is running real crypto right now (the ticker, the generated key)."

| Page                                          |  C  |   W   |  S  |  T  |   P   | Perf | Notes                                                                                                                                                                 |
| --------------------------------------------- | :-: | :---: | :-: | :-: | :---: | :--: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home: hero                                    |  5  |   4   |  5  |  5  |   4   |  5   | Real key generated in the browser (3.9 ms), globe assembles, ticker streams. Mobile wraps "India" onto its own line.                                                  |
| Home: scan                                    |  5  |   5   |  5  |  5  | **3** |  5   | The hook works (score ring, globe turn, saffron/cyan arc). **Mobile: the input collapses** (`flex-1` in a column layout). **The shimmer band stays on wide buttons.** |
| Home: why now → proof                         |  4  |   4   |  5  |  5  |   4   |  5   | Nine sections, one question each. Q-Day crack and ledger break are the section moments.                                                                               |
| Platform                                      |  4  |   3   |  5  |  5  |   4   |  4   | Clear diagram; the proof blocks repeat the home page's live demos (fine on a detail page).                                                                            |
| Solutions ×4                                  |  5  |   3   |  5  |  5  |   4   |  5   | Each sector: problem, workflow diagram, ML-KEM/ML-DSA, without vs with, honest scope.                                                                                 |
| Demos hub + Demos 1–4                         |  4  |   5   |  5  |  5  |   4   |  3   | Demos load their crypto + 3D up front (≈ 180–415 KB); outside the home budget by design.                                                                              |
| Presenter mode                                |  4  |   4   |  5  |  5  | **2** |  —   | **CSS `zoom` misaligns the WebGL views**: Demo 3's scene spills out of its panel.                                                                                     |
| /pitch                                        |  4  | **3** |  5  |  5  | **3** |  5   | Slides are clean but half the screen is empty on text slides.                                                                                                         |
| Docs (13 pages)                               |  5  |   3   |  5  |  5  |   4   |  5   | Quickstart, adapters, concepts, API reference from OpenAPI, security model.                                                                                           |
| Pricing / Security                            |  5  |   3   |  5  |  5  |   4   |  5   | Pro has no invented price; library audit status quoted from each library's own notes.                                                                                 |
| About / Changelog / Contact / Privacy / Terms |  4  |   3   |  5  |  5  |   4   |  5   | No fake logos, testimonials or metrics; legal pages are marked as drafts for review.                                                                                  |
| /scan/[host]                                  |  5  |   4   |  5  |  5  |   4   |  5   | Shareable result with its own OG card.                                                                                                                                |
| 404                                           |  5  |   4   |  5  |  5  |   4   |  5   | "This page was harvested. Just kidding."                                                                                                                              |

Found in the backup video before this round: a literal `‑` rendered in the scan headline (JSX attributes don't
process escapes). Fixed in phase C, with an e2e guard.

## Fixes for round 2

- **Presenter mode:** type now scales through `--type-scale` (all font sizes are `calc(px × var(--type-scale))`) instead
  of `zoom`, so layout and canvases are untouched.
- **/pitch:** text slides share the screen with the live globe (its own camera pose); wide slides (diagram, table,
  tiers) keep the full width.
- **Scan input on mobile:** `w-full`, `flex-1` only from `md` up.
- **Shimmer:** no fill mode, and it sweeps far enough to clear any button, so the band never stays on screen.
