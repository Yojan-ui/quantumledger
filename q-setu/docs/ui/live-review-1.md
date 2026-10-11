# Live review 1 (`live-1/`)

Captures: `live-1/scroll-30s.webm` (a 30 s scroll of the home page at 1440×900) and screenshots at 1440×900 (`desktop-*`)
and 390×844 (`mobile-*`).

Scores 1–5: **A** feels alive · **S** story clear in 5 seconds · **P** looks premium (Linear/Vercel tier) · **M** nothing
decorative without meaning.

| Section                   |   A   |  S  |   P   |   M   | Notes                                                                                                                                                                             |
| ------------------------- | :---: | :-: | :---: | :---: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero (strip + globe)      |   5   |  4  |   4   |   5   | Ticker streams real SEAL/VERIFY/LEDGER lines; arcs pulse per transaction; ripples on arrival. **Mobile: "quantum-/safe." breaks at the hyphen** (P 3 on mobile).                  |
| Why now                   | **2** |  5  |   4   |   5   | Clear and sourced, but entirely static: nothing ties "harvest now" to this moment.                                                                                                |
| Story 02 Seal             |   4   |  4  |   4   |   5   | Real in-browser seal.                                                                                                                                                             |
| Story 03–04 Harvest/Q-Day |   5   |  5  |   4   |   5   | The year counter scrubs 2026 → 2035, then classical rows really decrypt (Pollard's rho in the tab) while Q-Setu rows stay hex. The strongest moment.                              |
| Story 05–08               |   4   |  4  |   4   |   4   | Count-ups and the rail fill work. Story 06's zoom is cropped by its column (accepted earlier).                                                                                    |
| Product (P→F→P)           |   4   |  5  | **2** |   5   | **Mobile: the section headline lost its first line** ("fixed in one line." only). **Headline reveals never actually played**: a ResizeObserver fired on mount and cancelled them. |
| Why Q-Setu table          | **3** |  5  |   4   |   5   | Honest and readable, but it appears all at once.                                                                                                                                  |
| Industries                |   4   |  4  |   4   |   5   |                                                                                                                                                                                   |
| Demos                     |   4   |  4  |   4   |   5   | Four panels in a 2×2 grid; the previews are real recordings.                                                                                                                      |
| Demo 1                    |   4   |  4  | **3** | **3** | **The console floods with mesh SIGN lines** (noise, not meaning). **The Compute Meter wraps to 2 rows** at 1440.                                                                  |
| Demo 2                    |   4   |  4  | **3** |   5   | Counters climb after deploy. **The snippet in the 320 px column wraps mid-attribute** ("data-↵key").                                                                              |
| Demo 3                    |   4   |  5  | **3** |   5   | **"Q-DAY" collides with "2035"** under the timeline now that the column is narrower.                                                                                              |
| Demo 4 Q-Ledger           |   4   |  5  | **3** |   5   | **Rows are ~90 px tall**: the table has too many columns and the right ones are cut off.                                                                                          |
| Scanner                   | **3** |  4  | **3** |   5   | Lands empty until you press Scan. **The caption sits beside the title** (`basis-full` was capped by `max-w-text`).                                                                |

## Fixes for round 2

- **Hero:** the title uses a non-breaking hyphen (U+2011); screen-reader text keeps a plain one.
- **MaskHeading, first line:** fixed the measurement bug, where a line-0 `offsetTop` could be appended to `out[-1]`.
- **MaskHeading, reveal:** headlines now reveal when they scroll into view (IntersectionObserver), and only a real width change suppresses the replay.
- **Why now:**
  - "Today" gets a live counter: packets that crossed the demo network since you arrived (real SEAL events).
  - The facts columns stay static, which is deliberate.
- **Why Q-Setu:** rows stagger in (60 ms) when the table scrolls into view.
- **Demo 1:**
  - The console shows only this tab's operations, plus the server's POLICY, re-key and HANDSHAKE events.
  - The live p50/p95 moved into the meter's label column, back to 5 cells.
- **Demo 2:** the snippet no longer wraps (horizontal scroll inside the code block).
- **Demo 3:** the Q-Day marker has its own row under the timeline.
- **Demo 4:** the table is fixed-layout: 5 columns, truncated payload, compact rows.
- **Scanner:**
  - The default sample is scanned on load, so the page opens on real findings and a plan.
  - The caption wraps under the title.
