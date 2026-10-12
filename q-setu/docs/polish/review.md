# Polish pass: review

Before: `docs/polish/before/` (the site at commit `6738a43`). After: `docs/polish/after/` (every changed section at
1440×900 `desktop-*` and 390×844 `mobile-*`, with interactions) and `after/scroll-20s.webm`.

For each change: **what does this motion or colour tell the visitor?** Anything whose answer was "nothing" was
removed.

## Colour roles

| Change                                                                              | What it tells the visitor                                                                                                                                                                |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--kem` cyan on arcs, sealed packets, pillars, sockets                              | "This is encrypted with ML-KEM."                                                                                                                                                         |
| `--sig` indigo on the ledger links and the handshake's answer ring                  | "This is signed with ML-DSA: an edit would be detected."                                                                                                                                 |
| `--ok` mint on ✓, the interlocked cubes, the intact chain                           | "Checked just now; it held."                                                                                                                                                             |
| `--warn` saffron on classical packets, the Q-Day shards, "harvestable" results      | "Classical: recordable today, breakable at Q-Day."                                                                                                                                       |
| `--danger` red on rejected packets (ticker ✗, arc snap) and the edited ledger block | "An attack or edit was caught." Before, rejections shared saffron with "vulnerable"; now they are two different facts.                                                                   |
| Legend beside the globe and in every demo header                                    | Teaches the five meanings once. Each item explains itself on hover or focus.                                                                                                             |
| Ambient glow behind the globe and the ledger chain (8%, ≤ 900px)                    | The section's verdict at a glance: KEM in the hero, WARN while traffic is harvestable, the scan's result (KEM or WARN), OK while the ledger verifies, then DANGER once an edit is found. |
| 6px role dot before each home section's index label                                 | What the section is about: risk (WARN), protection (KEM), signatures (SIG), proof (OK).                                                                                                  |
| Progress ticks in "How it works"                                                    | Steps 1–2 are saffron (recorded, then opened); step 3 is KEM (sealed).                                                                                                                   |
| Active nav item: 1px KEM underline that slides                                      | Where you are.                                                                                                                                                                           |

Removed after review: a KEM→SIG hairline under section titles. It said nothing a role dot didn't already say.

## 3D additions (all in the single WebGL canvas via drei `View`; lazy-mounted, paused off-screen)

| Scene                                                     | What it tells the visitor                                                                                                                                                                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ocean dot layer at 8%                                     | Depth only: it turns a flat land outline into a sphere. It stays because it makes the globe readable as the Earth.                                                                                                                    |
| City light pillars (height = sealed ops in the last 60 s) | Where the live traffic is happening right now, and how much. Hovering a city brightens its pillar from 60% to 100% and shows the counts.                                                                                              |
| Cursor parallax (≤ 3.4°)                                  | The globe is a live object, not a picture (it already existed and stays within 4°).                                                                                                                                                   |
| Handshake cubes in "How it works", step 3                 | The protocol in four beats: the client sends an ML-KEM ciphertext (KEM packet), the server proves who it is (SIG ring), both derive one key (the cubes interlock), and it's verified (OK pulse). Scrubbed by scroll; click to replay. |
| Q-Day shatter                                             | The core argument in 1.15 s. The classical packet breaks into 40 saffron-edged shards and its plaintext appears. The ML-KEM packet only ripples (transmission material) and stays whole.                                              |
| Q-Ledger chain                                            | Why one edit matters: the edited block turns DANGER, and every link after it dims and drops 4px in a 60 ms cascade (nothing after it can be trusted). A clean verify lifts them back.                                                 |
| Adapter socket models (120px, on hover)                   | Which adapter you're reading about, and that it's a socket on the same globe: the model turns slowly and lights KEM, and so does its socket on the globe.                                                                             |

Motion rules held:

- Every easing is the token curve.
- Every loop is slower than one cycle per 4 s: the ledger drift is 8 s, the socket turn about 10 s.
- `prefers-reduced-motion` and screens narrower than 768px get static end states: the cubes interlocked, Q-Day already
  shattered, the chain without drift. Adapter models are hidden on phones.

## Bug found and fixed during review

drei's `View` sets the WebGL viewport to its own rectangle and doesn't restore it, so once a View was on screen the
globe drew into that small box and disappeared. `World.tsx` now resets the viewport before rendering the globe.

## Gates

| Gate                                                                                                   | Result                                                                             |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `pnpm lint:design` (role tokens allowed; raw colours, gradient text and other gradients still blocked) | ✓                                                                                  |
| `pnpm lint`                                                                                            | ✓                                                                                  |
| `pnpm test`                                                                                            | 105/105 ✓                                                                          |
| `pnpm build`                                                                                           | ✓                                                                                  |
| Playwright                                                                                             | 41/41 ✓                                                                            |
| Initial JS                                                                                             | 154.1 KB gzip, up 2.5 KB from 151.6 KB (allowance: 40 KB) ✓                        |
| Lighthouse CI on `/` (median of 3)                                                                     | Performance 99, Accessibility 100, Best practices 100, SEO 100, LCP 1.5 s, CLS 0 ✓ |

An early run of the new legend scored Accessibility 96 because of `aria-label` on a plain `<span>`. The meaning is now
real screen-reader text, and the tooltip is visual only.

**60 fps:** I can't measure frame rate on a mid-range laptop from this environment; headless runs use software
rendering. The scenes are small (40 shards, 12 blocks, 5 wireframes), mount only near the viewport and skip work when
off-screen. The transmission material renders at 256px with 4 samples. Check on the presentation machine.
