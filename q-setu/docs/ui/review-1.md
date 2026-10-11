# Review 1 (`after-1/`)

Scores 1–5: **H** hierarchy · **G** grid alignment · **S** spacing · **C** colour restraint (≤1 accent) · **T** type ·
**D** density (could anything be removed?) · **3D** calmness · **L** looks like Linear/Vercel rather than a template.

| Screen (desktop + mobile) | H   | G   | S     | C   | T   | D     | 3D    | L     | Notes                                                                                                            |
| ------------------------- | --- | --- | ----- | --- | --- | ----- | ----- | ----- | ---------------------------------------------------------------------------------------------------------------- |
| Story 01 Hero             | 4   | 4   | 4     | 4   | 4   | 4     | **1** | 3     | Globe framing bug: camera ~3× too close, land dots read as blobs. The globe area renders pure black, not `--bg`. |
| Story 02–05               | 4   | 4   | 4     | 4   | 4   | 4     | **1** | 3     | Same framing bug. Copy and panel are right.                                                                      |
| Story 06 India            | 4   | 4   | 4     | 3   | 4   | 4     | **1** | 2     | Nodes render as huge discs; the cyan ring dominates.                                                             |
| Story 07–08               | 4   | 4   | 4     | 4   | 4   | 4     | **2** | 3     | Framing.                                                                                                         |
| Adapters                  | 4   | 4   | 4     | 5   | 4   | 4     | **2** | 3     | **Copy button overlaps the code text**; globe framing.                                                           |
| Industries                | 5   | 5   | 4     | 5   | 4   | 4     | –     | 4     | Long stat labels wrap to 2 lines; acceptable.                                                                    |
| Without vs with           | 4   | 5   | 4     | 4   | 4   | 4     | –     | 4     | Both state dots, as the brief specifies.                                                                         |
| Demos                     | 4   | 5   | 4     | 5   | 4   | **3** | –     | **3** | Preview panels are empty (videos not recorded yet).                                                              |
| Final CTA / footer        | 5   | 5   | 5     | 5   | 4   | 5     | –     | 5     |                                                                                                                  |
| Demo 2                    | 4   | 4   | 4     | 4   | 4   | 3     | **1** | 3     | Camera framing; overlay labels hard to read.                                                                     |
| Demo 3                    | 4   | 4   | 4     | 4   | 4   | 4     | 4     | 4     | Calm. Q-Day marker sits close to "2035".                                                                         |
| Demo 1                    | 4   | 4   | 4     | 4   | 4   | 4     | **3** | 4     | Tubes are thick grey bands.                                                                                      |
| Scanner                   | 4   | 4   | 4     | 5   | 4   | 4     | –     | 4     |                                                                                                                  |
| Mobile demos              | 3   | 4   | **3** | 4   | 4   | **3** | –     | 3     | **The sticky Compute Meter takes ⅓ of the screen.**                                                              |

**Fix list:**

- Camera fit derived from the field of view.
- Transparent canvas, so the page `--bg` shows through.
- Tone mapping off (`flat`), so token colours render exactly.
- Copy button moved into the flow.
- Previews recorded.
- Thinner Demo 1 tubes.
- Compute Meter not sticky on mobile.
