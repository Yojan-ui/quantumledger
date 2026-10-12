# Review 3 (`after-3/`): passes (every score ≥ 4)

Same rubric. Every screen in `after-3/` was checked at 1440×900 and 390×844.

| Screen (desktop + mobile) | H   | G   | S   | C   | T   | D   | 3D  | L   |
| ------------------------- | --- | --- | --- | --- | --- | --- | --- | --- |
| Story 01 Hero             | 5   | 5   | 4   | 4   | 4   | 4   | 5   | 4   |
| Story 02 Seal             | 4   | 5   | 4   | 5   | 4   | 4   | 4   | 4   |
| Story 03 Harvest          | 5   | 5   | 4   | 5   | 4   | 5   | 5   | 4   |
| Story 04 Q-Day            | 4   | 5   | 4   | 5   | 4   | 4   | 4   | 4   |
| Story 05 Sockets          | 4   | 5   | 4   | 5   | 4   | 4   | 4   | 4   |
| Story 06 India            | 4   | 4   | 4   | 4   | 4   | 4   | 4   | 4   |
| Story 07 Cost             | 5   | 5   | 4   | 5   | 4   | 5   | 5   | 5   |
| Story 08 Close            | 4   | 5   | 4   | 5   | 4   | 5   | 4   | 4   |
| Adapters                  | 4   | 5   | 4   | 5   | 4   | 4   | 4   | 4   |
| Industries                | 5   | 5   | 4   | 5   | 4   | 4   | –   | 4   |
| Without vs with           | 4   | 5   | 4   | 4   | 4   | 4   | –   | 4   |
| Demos                     | 4   | 5   | 4   | 5   | 4   | 4   | –   | 4   |
| Final CTA / footer        | 5   | 5   | 5   | 5   | 4   | 5   | –   | 5   |
| Demo hub                  | 4   | 5   | 4   | 5   | 4   | 4   | –   | 4   |
| Demo 1                    | 4   | 4   | 4   | 4   | 4   | 4   | 4   | 4   |
| Demo 2                    | 4   | 4   | 4   | 4   | 4   | 4   | 4   | 4   |
| Demo 3                    | 4   | 4   | 4   | 4   | 4   | 4   | 4   | 4   |
| Scanner                   | 4   | 4   | 4   | 5   | 4   | 4   | –   | 4   |
| Docs                      | 4   | 5   | 4   | 5   | 4   | 4   | –   | 4   |
| Mobile (all)              | 4   | 4   | 4   | 5   | 4   | 4   | 4   | 4   |

**Gates:** `pnpm lint:design` ✓, `pnpm lint` ✓, `pnpm test` (83) ✓, `pnpm build` (0 errors, 0 warnings) ✓,
Playwright smoke tests (7) ✓.

## Deliberate exceptions (documented, not regressions)

- **Hero headline:** 3 lines instead of the 2-line rule. The brief fixes both the copy ("Make anything in India
  quantum-safe. In one line.", 9 words) and the size (72px), and that combination can't fit 2 lines inside the
  hero's text columns. The text block spans 7 columns instead of 6 to keep it to 3 lines.
- **Two accents in one viewport:** only where the brief asks for a state comparison.
  - The "Without vs with" table (its saffron ● and cyan ● dots are specified).
  - Demo 3 after Q-Day: classical rows saffron ●, QuantumLedger rows cyan ●.
  - Demo 1 during "Attack it" (one saffron packet against cyan seals).
    Everywhere else each chapter declares one accent, and the globe follows it.
- **Label contrast:** `--text-3` (#62666D) on `--bg` is ~3.5:1, below WCAG AA for 12px text. It's used, as specified,
  only for labels, indices and captions. Everything a reader needs (headings, body, values) is `--text`/`--text-2`.
- **Story 06 crop:** the globe is cropped at its column edge when zoomed into India. That's intentional: the
  world is scissored to its own columns, so it can never sit behind text.

## Remaining nits (score 4, not fixed)

- Preview videos are captured at 1280×720 and scaled down, so small UI text inside them is still small.
- Demo 2's globe crop looks tight; a slightly wider pose would show more of the Bay of Bengal.
