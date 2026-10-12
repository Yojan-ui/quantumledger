# Motion review 1: /diagnostics in autoplay

Recorded with `node scripts/record-motion.mjs docs/motion/after-1` against the production build, system Chrome
on an Apple M4 (Metal). Autoplay runs the labelled cached example (`ecc256.badssl.com`, a public TLS test
site). Files: `diagnostics-1440.webm`, `diagnostics-390.webm`, `stage-<n>-<stage>-<width>.png`, `metrics.json`.

## Per stage

| Stage         | Caption                             | Says what happens to the data?                                         | Caused by a real event?                                            | Unlabelled or uncited numbers?                                                                                             | Below 50 fps?            | Q-Setu? |
| ------------- | ----------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------- |
| 01 HARVESTING | Encrypted today, recorded for later | Yes                                                                    | Yes: the TLS probe result (cached real scan, labelled)             | None: TLS version, group and certificate are the scan's; the copy counter is labelled "(sim)"                              | No: 60 fps at both sizes | No      |
| 02 SHELF-LIFE | The stolen data outlives its lock   | Yes                                                                    | Yes: the server's migration plan for the findings                  | None: risk = 100 − the scanner's score (explained in the gauge); Z and Q-Day are labelled "estimate" and cited to GRI 2025 | No                       | No      |
| 03 LATTICE    | Swap the lock for a lattice         | Partly: it names the fix, not the data. Kept: it's the brief's caption | Yes: a full hybrid handshake in the worker                         | None: ciphertext size, HKDF, session and ms are the handshake's; the target's new group and certificate are "(sim)"        | No                       | No      |
| 04 ANCHORED   | Locked into the chain               | Yes                                                                    | Yes: the anchor entry appended to the Proof Chain                  | None: root, block hash and signature are the ledger's                                                                      | No                       | No      |
| 05 VERIFIED   | Quantum-safe, and provably so       | Yes                                                                    | Yes: the sweep result (checkpoint signature, segment, Merkle root) | None: "100% PQC-READY (sim)"; the patched score is "(sim)"                                                                 | No                       | No      |

Frame rate (measured, no recording): every stage 60 fps at 1440 and 390; p95 frame 16.8 ms; 0% of frames
over 20 ms. The one dip: "AWAITING TARGET" on the phone at 44 fps, i.e. page load before the first scan.

Rendered page text: no "Q-Setu" or "Q-Ledger" at either size.

## Found

1. **Phone: the stage is empty during HARVESTING.** The shared canvas waits for a first tap (or 4.5 s) on
   phones; the cached scan finishes in 0.3 s, so stage 1 plays to an empty frame.
2. **Phone: 3D labels escape the stage.** drei `Html` labels aren't clipped to their View: the storage
   counter floats over the panels below, and the top labels cover the bracketed title.
3. **Desktop: the storage label collides with the caption** (stages 1 and 3), and in stage 3 with
   "WIRETAP DISSOLVED".
4. **Stage 4 looks early in the screenshot.** The effect starts when the camera arrives (1.6 s) and the
   block locks 1.5 s later; the recorder shot at 2.8 s. Autoplay itself holds 4.4 s, so viewers see it.
5. The bracketed title and the hints share the stage's top edge with the 3D labels on narrow stages.

## Fixes for pass 2

1. The canvas starts at once on pages with a diagnostics stage, and the pipeline waits for the canvas
   (up to 5 s) before its first real scan.
2. On phones the anchored 3D labels are off (the drawer below shows the same real values); the
   verified badge stays.
3. The storage label moves up and right of the cylinder; "WIRETAP DISSOLVED" moves left of it.
4. The recorder waits for each stage's own animation length before its screenshot.
