# Wow pass, part 0: baseline

`node scripts/wow-shots.mjs before`: `/`, `/diagnostics` and every `/demo/*` route at 1440 and 390, the
first screen 4 s after load, plus one frame per homepage section (`home-<w>-sNN-<section>.png`).
Production build, system Chrome on an Apple M4.

| # | Issue from the brief | Seen in the baseline | Evidence |
| --- | --- | --- | --- |
| 1 | No wow at load: text, then an empty box | Yes. At 390 the hero stage reads "QUANTUMLEDGER: AWAITING TARGET" over an empty frame. At 1440 the cached example has started by 4 s, so the red swarm is visible, but it's a boxed panel below the headline, not the hero. | `home-390.png`, `home-1440.png` |
| 2 | The same globe repeats | Yes. Join live, the Index, Scan, How it works and Deploy anywhere all put the text on the left and the same globe at the same size on the right. | `home-1440-s01…s06` |
| 3 | Hairline lines | Yes. Arcs, the graticule, cubes, vault and the adapter icons are all 1 px. | `home-1440-s06-adapters.png`, `diagnostics-1440.png` |
| 4 | Small boxed demo stages | Yes. On `/demo/deploy` the stage is a ~400 px box between the system list and an equally tall console. | `demo_deploy-1440.png` |
| 5 | Labels collide in SHELF-LIFE | Not in this frame: the SHELF-LIFE labels hadn't faded in yet at the moment of capture. The anchors are not clamped to the stage, so it can happen; fixed in part 5 either way. | `diagnostics-1440.png` |
| 6 | Terminal breaks mid-word | Yes: "TL / Sv1.2", "key ex / change". | `diagnostics-1440.png` |
| 7 | Dead zones | Yes. The Diagnostics left panel is empty below SIGNATURE. The Deploy console says "Waiting for operations…". There are 150–200 px black gaps above section labels on the homepage. | `diagnostics-1440.png`, `demo_deploy-1440.png`, `home-1440-s03-index.png` |
| 8 | Everything the same weight | Yes. Every section headline is the same h1 size, left aligned, with the same label above it. | `home-1440-s0*` |
