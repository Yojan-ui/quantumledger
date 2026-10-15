# Motion pass, review 2

Branch `motion-pass` at a442e10 (plus two lint-only edits), against `shield-real` (8a28bc3).
Recordings: `node scripts/motion-record.mjs docs/motion2/after-2` → `docs/motion2/after-2/<scene>.webm`
(1440×900; kept out of git) and `fps.json`. Same scenes as review 1.

## What changed since review 1

- **The Shield scene on phones** (a442e10): at 390 px the finding labels piled up and ran past the
  stage, and the page went 634 px wide during the dive. On a phone each beat now shows only its key
  label (the score, the handshake, the recorder, the typed line, the attack); the caption and console
  carry the rest. The page is 390 px wide for the whole dive.
- **Review tooling**: `fps.json` records when each slow frame happened (`spikes`: ms since load, frame
  ms); `MEASURE=1` skips the video pass; `motion-check.mjs` takes a phone viewport (`W=390`).
- Two lint warnings fixed in `LedgerFilm.tsx` and `ShieldDive.tsx` (no behaviour change).

## Frame times

| Scene             | p50 / p95 (ms) | > 20 ms | Worst frame, at           |
| ----------------- | -------------- | ------- | ------------------------- |
| Diagnostics       | 16.7 / 16.8    | 0.19%   | 100 ms, 613 ms after load |
| Homepage          | 16.7 / 16.8    | 0.20%   | 100 ms, 665 ms after load |
| How it works      | 16.7 / 16.8    | 0.07%   | 100 ms, 606 ms after load |
| Q-Day             | 16.7 / 16.7    | 0.13%   | 83 ms, 737 ms after load  |
| Proof Chain       | 16.7 / 16.8    | 0.06%   | 83 ms, 682 ms after load  |
| Demo 2, DNS       | 16.7 / 16.8    | 0.04%   | 117 ms, 649 ms after load |
| Demo 2, container | 16.7 / 16.7    | 0.04%   | 100 ms, 637 ms after load |
| Demo 2, code      | 16.7 / 16.7    | 0.05%   | 100 ms, 647 ms after load |
| Deploy all        | 16.7 / 16.7    | 0.01%   | 100 ms, 644 ms after load |

## Worst single frames: found

Review 1's 67–100 ms frames are one frame per scene, and every one lands 600–740 ms after the page
starts loading: page start-up (scripts evaluating, the canvas and shaders compiling), never during a
scene's motion. `shield-real` has the same frame at the same moment (measured on :3200: diagnostics
100 ms at 611 ms, How it works 67 ms at 577, Q-Day 83 ms at 673, Proof Chain 67 ms at 590). It isn't
from the motion pass, and no frame in any scene's motion is over 20 ms more than 0.2% of the time.

## The visual check: the UI outside the 3D

`python3 scripts/motion-diff.py docs/motion2/baseline/nocanvas docs/motion2/after-2/nocanvas
docs/motion2/baseline/noise/1 docs/motion2/baseline/noise/2`: 79 screens, canvas hidden. 63 match.
The 16 that don't are all live content (each diff image checked by eye):

- Server-measured numbers: the compute meter on every demo page (`demo_*`: live seal p50/p95, per
  message, handshake) and the Platform page's proof figures (`platform-05`, `platform-06`).
- Console lines and their timestamps (`demo_deploy-01`, `demo_how_it_works-01/02`, `diagnostics-01`,
  `demo_ledger-01/02`: the ledger's entry number has moved on).
- Counts and recorded hashes: Q-Day's "recorded so far" and its newest packet (`demo_qday-01/02`),
  the homepage's packets-recorded counter (`home-09/10/11`) and live readouts (`home-01`).
- As in review 1: `home-07` (the Readiness Index labels, pinned to its 3D bars) and `demo_deploy-02`
  (the globe's glow, placed by the globe camera).

Review 1 had 7 of these; the 9 more here are the same live figures, which have drifted further from
the baseline because the server had been running for hours. No layout, colour, font, spacing or copy
differs anywhere.

## Checks

| Check                                                         | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node scripts/check-motion-only.mjs`                          | ✓ 321 changed paths against shield-real, all 3D motion or a listed exception                                                                                                                                                                                                                                                                                                                                                                           |
| Canvas-hidden pixel diff                                      | 63 of 79 identical; the 16 others are live content (above)                                                                                                                                                                                                                                                                                                                                                                                             |
| `pnpm audit:glitch after-2` (`docs/motion2/audit-after-2.md`) | 0 hydration warnings, 0 WebGL messages, 0 contexts lost, 0 console warnings. Errors, as in review 1: the 404 page's own status (both widths) and `ERR_NETWORK_IO_SUSPENDED` once each on the 404 page and `/join` (the machine suspended the network mid-run). Worst CLS 0.022 / 0.024 (review 1: 0.019 / 0.094)                                                                                                                                       |
| `pnpm lint`                                                   | ✓ (one warning, in `lib/server/log.ts`, unchanged from shield-real)                                                                                                                                                                                                                                                                                                                                                                                    |
| `pnpm test`                                                   | ✓ 233 tests                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `pnpm check:budget`                                           | ✓ 242.2 KB initial JS on `/` (budget 250 KB; review 1: 242.2 KB)                                                                                                                                                                                                                                                                                                                                                                                       |
| `pnpm test:e2e`                                               | ✓ 52 tests. Two earlier runs failed for reasons outside the branch: on the server that had served every recording and audit, the rate limiter answered the test browser with 429s (34 failed); on a just-started server, the L5 → L3 policy switch timed out once and left the live policy at ML-DSA-87, so four later tests expecting ML-DSA-65 failed. Each passed on its own, the diagnostics spec 3 of 3 times, and the next full run passed whole |
| Demo 2 dive at 390 px                                         | ✓ page width 390 px throughout; the dive's controls in view                                                                                                                                                                                                                                                                                                                                                                                            |
