# Review 2 (`after-2/`)

Same rubric as review 1.

| Screen (desktop + mobile) | H   | G     | S     | C   | T   | D   | 3D    | L     | Notes                                                                                                  |
| ------------------------- | --- | ----- | ----- | --- | --- | --- | ----- | ----- | ------------------------------------------------------------------------------------------------------ |
| Story 01 Hero             | 5   | 5     | 4     | 4   | 4   | 4   | 4     | 4     | The headline is 3 lines at 72px (see note below). The stats row reads like Linear's changelog numbers. |
| Story 02 Seal             | 4   | 5     | 4     | 5   | 4   | 4   | 4     | 4     |                                                                                                        |
| Story 03 Harvest          | 4   | 5     | 4     | 5   | 4   | 5   | 4     | 4     | One saffron arc, nothing else coloured.                                                                |
| Story 04 Q-Day            | 4   | 4     | 4     | 5   | 4   | 4   | 4     | 4     | **Fragments overflow the code block** (lines cut at the edge).                                         |
| Story 05–08               | 4   | 5     | 4     | 5   | 4   | 4   | 4     | 4     |                                                                                                        |
| Story 06 India            | 4   | 4     | 4     | 4   | 4   | 4   | 4     | 4     | Zoomed globe is cropped by its column (by design: it never crosses into text).                         |
| Adapters                  | 4   | 5     | 4     | 5   | 4   | 4   | 4     | 4     |                                                                                                        |
| Industries                | 5   | 5     | 4     | 5   | 4   | 4   | –     | 4     |                                                                                                        |
| Demos                     | 4   | 5     | 4     | 5   | 4   | 4   | –     | **3** | Previews show the whole page chrome at thumbnail size and are unreadable.                              |
| Demo 2                    | 4   | 4     | 4     | 4   | 4   | 4   | 4     | **3** | **Counter and credit labels sit on top of the land dots**; snippet breaks mid-word.                    |
| Demo 1                    | 4   | 4     | 4     | 4   | 4   | 4   | **3** | 4     | Tubes still read heavy.                                                                                |
| Scanner                   | 4   | **3** | 4     | 5   | 4   | 4   | –     | 4     | Caption sits beside the title instead of below it.                                                     |
| Mobile story              | 4   | 4     | **3** | 5   | 4   | 4   | 4     | 4     | Large dead gap between the globe block and the text (the grid stretches its rows).                     |

**Fix list:**

- Word-wrapping `Code` for the Q-Day fragments.
- Demo 2 labels moved outside the globe window.
- `?embed=1` + autoplay mode for chrome-free recordings, and previews re-recorded.
- Demo 1 tubes thinned to a hairline.
- Scanner caption placed with `basis-full`.
- `content-start` on the mobile story grid.
