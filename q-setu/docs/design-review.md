# Design review log

Method: Playwright screenshots of every story chapter (and the editorial sections) at 1440 px and
375 px, critiqued against the brief's banned list (5.1) and visual language (5.2), fixed, and
re-shot. REFERENCE_URL was not provided, so no side-by-side comparison with the reference was made.

## Round 1 (1440 px)

| Chapter    | Problem found                                                                                           | Rule                            | Fix                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 Hero    | Headline wrapped to 6 lines in a 5-column panel; "quantum-safe" broke at its hyphen.                    | 5.2 type scale, line reveals    | Hero panel widened to 6–7 columns, lines authored explicitly, non-breaking hyphen.                                                                          |
| 02–08      | Chapter headlines rendered at body size (the `text-title` token was missing after a formatter rewrite). | 5.2 display face 64–140 px      | Restored `display` / `title` sizes in the Tailwind config.                                                                                                  |
| 02 Seal    | Key lattice and sealed text formed above the frame and were clipped; lattice read as noise.             | 5.1 "particles with no meaning" | Lattice moved in front of the globe, tilted so the three ML-KEM polynomial sheets read as stacked planes; nodes tightened. Text moved to the globe's front. |
| 03 Harvest | Recording ring too faint to read as "recording".                                                        | 5.3 motion must explain         | Larger ring dots; lit dots count real harvested pulses.                                                                                                     |
| 06 India   | Dolly-in stopped too far out; India filled ~15% of the globe.                                           | 5.4 step 6                      | India pose distance 1.9 → 1.0.                                                                                                                              |
| 07 Cost    | Handshake pulse and message sparks ran on a short arc and were invisible.                               | 5.3                             | Moved to the long Mumbai–London arc.                                                                                                                        |
| 08 Close   | Glass core sat inside the globe and was hidden by the occluder.                                         | 5.4 step 8                      | Globe condenses (scales down) as the core grows.                                                                                                            |
| All        | Step panel jumped vertically between chapters (content heights differ).                                 | 5.2 strict grid                 | Panel anchored at a fixed top offset.                                                                                                                       |

Kept: dotted globe with fresnel rim, saffron only for India/vulnerable states, mono micro-labels,
left-aligned asymmetric layout, single canvas.
