# Live review 2 (`live-2/`)

Same rubric: **A** feels alive · **S** story clear in 5 seconds · **P** looks premium · **M** nothing decorative
without meaning. Every round 1 fix was confirmed in the captures.

| Section            |   A   |  S  |   P   |  M  | Notes                                                                                                                                             |
| ------------------ | :---: | :-: | :---: | :-: | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero               |   5   |  4  |   4   |  5  | The hyphen holds. **Mobile ticker clips the algorithm ID mid-word** ("m…").                                                                       |
| Why now            |   4   |  5  |   4   |  5  | The live "packets since you arrived" counter ties harvest-now to this moment.                                                                     |
| Story 02–08        |   4   |  5  |   4   |  5  | Headlines now actually rise line by line on each chapter change.                                                                                  |
| Product            |   4   |  5  |   4   |  5  | The mobile headline is complete; reveals play on scroll.                                                                                          |
| Why QuantumLedger  |   4   |  5  |   4   |  5  | Rows stagger in.                                                                                                                                  |
| Industries / Demos |   4   |  4  |   4   |  5  |                                                                                                                                                   |
| Demo 1             | **3** |  4  | **3** |  4  | **The console is empty until you press Play** (the quiet filter went too far). **The meter still wraps**: the live line widened its label column. |
| Demo 2             |   4   |  4  |   4   |  5  | Snippet scrolls instead of wrapping.                                                                                                              |
| Demo 3             |   4   |  5  | **3** |  5  | **"↑ Q-DAY" wraps onto two lines** in the narrow column. Meter wraps (same cause as Demo 1).                                                      |
| Demo 4 Proof Chain |   5   |  5  |   4   |  5  | Compact rows. The count climbs with live traffic.                                                                                                 |
| Scanner            |   4   |  5  |   4   |  5  | Lands on a real Critical result. Caption under the title.                                                                                         |

Also found: uppercase mono labels turn `µs` into `MS` (Greek mu uppercases to capital Mu), so the live p50 read
"163 MS" for 163 µs.

## Fixes for round 3

- **Compute Meter:** the live p50/p95 replaces the "% of a 100 ms request" cell until a step has run, which keeps 5 cells and
  one row. The value is not uppercased, so `µs` stays `µs`.
- **Demo 1 console:** also shows the mesh's live key ratchets (`ROTATE hkdf-sha256 …`), so it shows real agility
  events before you press Play.
- **Demo 3:** the Q-Day marker is `whitespace-nowrap`.
- **Mobile ticker:** shows time · op · ✓ only; the algorithm and bytes columns appear from `md` up.
