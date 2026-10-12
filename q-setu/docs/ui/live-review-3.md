# Live review 3 (`live-3/`): passes (every score ≥ 4)

Captures: `live-3/scroll-30s.webm` (30 s scroll at 1440×900) and screenshots at 1440×900 and 390×844.

| Section                         |  A  |  S  |  P  |  M  |
| ------------------------------- | :-: | :-: | :-: | :-: |
| Hero (live strip + globe)       |  5  |  4  |  4  |  5  |
| Why now                         |  4  |  5  |  4  |  5  |
| Story 02 Seal                   |  4  |  4  |  4  |  5  |
| Story 03–04 Harvest → Q-Day     |  5  |  5  |  4  |  5  |
| Story 05–08                     |  4  |  4  |  4  |  4  |
| Product (Problem → Fix → Proof) |  4  |  5  |  4  |  5  |
| Why QuantumLedger               |  4  |  5  |  4  |  5  |
| Industries                      |  4  |  4  |  4  |  5  |
| Demos (4 previews)              |  4  |  4  |  4  |  5  |
| Demo 1 · How it works           |  4  |  4  |  4  |  4  |
| Demo 2 · Deploy anywhere        |  4  |  4  |  4  |  5  |
| Demo 3 · Q-Day                  |  4  |  5  |  4  |  5  |
| Demo 4 · Proof Chain            |  5  |  5  |  4  |  5  |
| Scanner + plan                  |  4  |  5  |  4  |  5  |

**Gates:** `pnpm lint` (ESLint, `lint:design`, Prettier) ✓ · `pnpm test` 98/98 ✓ · `pnpm build` ✓ · Playwright 9/9 ✓.

## Deliberate exceptions

- **Two accents in one viewport, where the brief asks for it:**
  - The ticker's ✓ (cyan) and ✗ (saffron).
  - A rejected packet's saffron flash on an otherwise cyan globe.
  - The "Without QuantumLedger" notes (`--warn`) under each feature block.
  - Demo 3's exposed counter.

  Each saffron mark means "vulnerable or rejected", never decoration.

- **Gradients:** exactly three. The panel spotlight (`.spotlight`, `--line-strong` at ~6%), the accent hairline
  (`.hairline-accent`) and the globe atmosphere (a shader). `lint:design` rejects any other.
- **Story 06** crops the zoomed globe at its column edge, so it never sits behind text (unchanged from the redesign).
- **The Q-Day scene's short dashes** are recorded packets seen edge-on. They carry meaning, so they stay.

## Remaining nits (score 4, not fixed)

- Odometer screenshots can catch a digit mid-roll. That's correct motion, but it can look like a glitch in a still frame.
- The mobile hero headline wraps as "Make anything in / India / quantum‑safe. In / one line." It's readable but ragged.
