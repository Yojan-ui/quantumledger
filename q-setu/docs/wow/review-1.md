# Wow pass: review 1

Shots: `node scripts/wow-shots.mjs after-1` (`/`, `/diagnostics` and every demo at 1440 and 390, plus one
frame per homepage section). Video and frame rate: `node scripts/wow-video.mjs after-1`, giving
`attract-1440.webm` (the opening), `home-scroll-1440.webm` (45 s, top to bottom) and `fps.json` (the same
scroll, unrecorded, frames grouped by section). Production build, system Chrome, Apple M4.

## Is each Part 0 issue fixed?

| #   | Issue                        | Status                                                                                                                                                                                                                                                                                                                                                                                                                                 | Evidence                                             |
| --- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | No wow at load               | **Fixed.** The 3D is the hero, full bleed. A real ML-KEM-768 key pair (its time is shown) is followed by the particles assembling the lattice-cube mark, which bursts into the swarm. Then the five real stages play on the cached example in ~7 s, labelled "cached example · scanned 2026-10-12". The pill goes THREAT CRITICAL → MITIGATING → SECURED, and the headline lands with the stages. Then "Enter any website" takes over. | `attract-1440.webm`, `home-1440.png`, `home-390.png` |
| 2   | The same globe repeats       | **Fixed.** Each section has its own shot and composition (below).                                                                                                                                                                                                                                                                                                                                                                      | `home-1440-s01…s12`                                  |
| 3   | Hairline lines               | **Fixed.** Every structure line and the arcs are screen-space thick lines (1.5–3 px) with a glow pass. Blocks are glass, the drum is metal, and the lattice is a crystal of solid nodes.                                                                                                                                                                                                                                               | `diagnostics-1440.png`, `home-1440-s03-index.png`    |
| 4   | Small boxed demo stages      | **Fixed.** Every demo stage is full bleed and at least 70vh. The console is a drawer over its edge, showing 3 lines until expanded. The controls are one floating pill.                                                                                                                                                                                                                                                                | `demo_*-1440.png`                                    |
| 5   | Labels collide in SHELF-LIFE | **Fixed.** One layout pass per frame clamps every label inside its stage and pushes overlaps apart along their leaders. The vault counter, which spilled onto the stepper, now stays inside.                                                                                                                                                                                                                                           | `diagnostics-1440.png`                               |
| 6   | Terminal breaks mid-word     | **Fixed.** Fixed columns (time · verb · subject · value), with the subject truncated and the full line in a tooltip.                                                                                                                                                                                                                                                                                                                   | `diagnostics-1440.png`                               |
| 7   | Dead zones                   | **Fixed.** The Diagnostics panel now ends with live p50 sparklines and the L1/L3/L5 suite card. Empty consoles show the latest real bus operations, labelled. Text sections sit 160 px apart, down from 320.                                                                                                                                                                                                                           | `diagnostics-1440.png`, `demo_deploy-1440.png`       |
| 8   | Everything the same weight   | **Fixed.** Display 96 / h1 64 / h2 44 / h3 28 / body 17, and each section's key number at 160 px (51% on the Index).                                                                                                                                                                                                                                                                                                                   | `home-1440-s03-index.png`                            |

## Does each homepage section have a visibly different shot?

| Section           | Shot                                                                     | Composition                                  |
| ----------------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| Hero              | Inside the diagnostics scene: the sphere and lattice, lens-shifted right | Full bleed, headline bottom-left             |
| Join live         | Pulls back from one node close up to the whole globe                     | Full bleed, statement centred, QR card below |
| Analogy           | One object morphing lock → key → copied boxes → lattice lock             | Pinned: object left, cards sliding right     |
| Readiness Index   | A low angle over India; glass columns with light pools                   | Split 5/7, the number at 160 px              |
| Scan your site    | Close and low over the city; a tower of dots at the server               | Flipped split: globe left                    |
| How it works      | Side-on along the Mumbai → London arc                                    | Sticky text over a full-bleed 3D             |
| Deploy anywhere   | Orbit of five metal objects (shield, browser, package, chip, vault door) | Pinned horizontal scroller                   |
| (band)            | A wide pull-back while India turns sealed in a wave                      | A centred statement over a full bleed        |
| Solutions → close | No 3D: text lists                                                        | Large type, content height                   |

No two consecutive sections share a framing.

## Is there a moment in the first 10 seconds a judge would remember?

Yes: the opening. About 2 s in, the swarm's own particles form the QuantumLedger lattice cube, with
"ML-KEM-768 key pair · 4.70 ms · in this browser" beside it (a real key pair, generated in this tab). It
explodes outward into the red harvesting swarm. In the next ~7 s the same scene runs the real pipeline:
red, the lattice snaps in, the block locks, the radar sweep turns it green. "Fix it." and "Prove it." land
as those stages complete.

## Is any label or panel overlapping?

At 1440: none in the after-1 shots. Three were found in this pass:

1. **Phones, every demo:** the floating pill wrapped onto two rows and the stage clipped the second (Play,
   Replay). Fixed: on phones it is one row (step dots, arrows, Play, Replay); the current step's name
   shows from `md` up.
2. **Phones, Deploy anywhere:** the orbit aimed for the desktop framing, so the objects sat half off
   screen. Fixed: phones get a wider, centred orbit.
3. **The Q-Day banner sat on the nav.** It used `top-20`, which didn't exist in the spacing scale. That
   scale also quietly broke the 80 px section rhythm. Fixed in part 7 by adding 20 (80 px) to it.

## Is anything below 50 fps?

No. The 45 s homepage scroll holds 60 fps in every section: p95 frame 16.7–16.8 ms, 0% of frames over
20 ms (`fps.json`). The only long frame is one of 83 ms during the opening, at the 3D boot (0.3% of
the opening's frames).

## Fixed for pass 2

The two phone fixes above.
