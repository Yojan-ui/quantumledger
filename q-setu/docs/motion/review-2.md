# Motion review 2: /diagnostics in autoplay, after the pass-1 fixes

Same method as review 1: `node scripts/record-motion.mjs docs/motion/after-2`, production build, system Chrome
on an Apple M4 (Metal), the labelled cached example. Pass 2 ran twice. The first recording found three more
problems (below). They were fixed, and `after-2/` holds the re-recording.

## Per stage (final recording)

| Stage         | Caption                             | Says what happens to the data?                                    | Caused by a real event?                                                                         | Unlabelled or uncited numbers?                                                                                                        | Below 50 fps?                     | Q-Setu? |
| ------------- | ----------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------- |
| 01 HARVESTING | Encrypted today, recorded for later | Yes                                                               | Yes: the TLS probe result; the stage now waits for the 3D canvas before scanning, so it is seen | None: the scan's values; the copy counter is "(sim)"                                                                                  | No: 55 fps at 1440, 60 fps on 390 | No      |
| 02 SHELF-LIFE | The stolen data outlives its lock   | Yes                                                               | Yes: the server's migration plan                                                                | None: risk = 100 − scanner score; Z 10–15 yr and Q-Day 2036–2041 labelled "estimate", cited (GRI Quantum Threat Timeline Report 2025) | No: 60 / 60                       | No      |
| 03 LATTICE    | Swap the lock for a lattice         | Partly (names the fix, not the data): the brief's caption is kept | Yes: the hybrid handshake (ML-KEM-768 at L3) in the worker                                      | None: 1,088 B ciphertext, HKDF, session ID and ms are the handshake's; target group and certificate "(sim)"                           | No: 60 / 60                       | No      |
| 04 ANCHORED   | Locked into the chain               | Yes                                                               | Yes: the anchor appended to the Proof Chain (after a signed checkpoint)                         | None: root, block hash, ML-DSA-65 signature are the ledger's                                                                          | No: 60 / 60                       | No      |
| 05 VERIFIED   | Quantum-safe, and provably so       | Yes                                                               | Yes: the sweep result (fresh checkpoint signature, the entries after it, the Merkle root)       | None: "100% PQC-READY (sim)", patched score 97 "(sim)"                                                                                | No: 60 / 60                       | No      |

The whole autoplay run takes about 21 s.

**Frame rate.** Measured in a run without recording. Every stage holds 55–60 fps. The lowest is HARVESTING at
1440 (55 fps, 0.6% of frames over 20 ms). The only stretch below 60 is the page loading before the first scan:
53 fps on the phone, 58 fps at 1440.

**Rendered text.** No "Q-Setu" or "Q-Ledger" at either size.

## Fixed since review 1

1. Phones now start the 3D canvas at once on pages with a diagnostics stage. The pipeline waits up to 5 s for
   it before the first scan, so HARVESTING plays on screen.
2. On phones the anchored 3D labels are off. They escaped the small stage and covered the panels and the
   title. The drawer below shows the same values; the verified badge stays.
3. The storage label moved off the caption, and "WIRETAP DISSOLVED" moved away from it.
4. The recorder now times each screenshot from the moment that stage's real result arrived. Its sleeps used
   to block, which put some screenshots on the following stage.

## Found in the first pass-2 recording, then fixed

1. **Desktop: the storage label escaped the stage** in the shots that don't frame its cylinder (SHELF-LIFE,
   ANCHORED), floating over the stepper. The label now shows only in the stages whose shots frame the
   cylinder.
2. **Phone: the particle "X + Y > Z" overlapped the stage title.** On phones it now sits lower and is drawn
   at 75%.
3. The screenshot timing was fixed as in item 4 above.

## Still open

- On the 390 px stage the ANCHORED title runs into the top of the chain row. It's readable, but tight.
- The HUD's lean at ANCHORED (8°, 1.5 s) tilts the panels with CSS, while the 3D stage keeps drawing into
  its bounding box. For that 1.5 s the stage edge and the panel frame don't line up exactly.
- **Not built, by design: Bloom and depth of field.** A post-processing pass would take over the shared
  canvas that every page's 3D draws into. The stage uses additive halos for glow, and dims whatever is out
  of focus instead of blurring it. Neither is used on phones.
