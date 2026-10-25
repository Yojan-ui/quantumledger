# Judge rehearsal 1

Production build of `motion-pass` at b5db500, system Chrome (ANGLE Metal, Apple M4), `?tour=1` played
end to end. At the join step a second, phone-sized browser opened `/join` and sealed a real message.
Script: `docs/rehearsal/rehearse-1.mjs`. Videos are Playwright `.webm` (ffmpeg isn't installed, so no
`.mp4`). Each run logged rAF frame times, how often the 3D actually drew, long tasks, errors and
outside requests, and took a screenshot every 3.5 s (evidence in `shots-1/`).

| Run | Server                                                               | Viewport            | Mode                          | Video      |
| --- | -------------------------------------------------------------------- | ------------------- | ----------------------------- | ---------- |
| 1   | :3400 online                                                         | 1440×900            | `/?present=1` then `/?tour=1` | run-1.webm |
| 2   | :3100 (`QSETU_OFFLINE=1`, `.data-offline`), outside requests aborted | 1440×900            | same                          | run-2.webm |
| 3   | :3400 online                                                         | 390×844 (iPhone 13) | `/?tour=1`                    | run-3.webm |

Run 1a was an earlier, unrecorded 1440 online pass; its timings are included.

## Step timings (s)

| Step        | 1a online 1440 | 1 online 1440 | 2 offline 1440 | 3 online 390 |
| ----------- | -------------- | ------------- | -------------- | ------------ |
| diagnostics | 18.5           | **49.7**      | 18.0           | **49.8**     |
| hero        | 15.1           | 14.1          | 14.1           | 14.0         |
| phone       | 8.5            | 4.3           | 4.2            | 4.5          |
| index       | 15.9           | 15.9          | 15.9           | 15.8         |
| qday        | 20.7           | 18.4          | 18.4           | 17.2         |
| deploy      | 17.1           | 17.1          | 16.9           | 15.2         |
| ledger      | 22.2           | 17.4          | 18.4           | 17.7         |
| impact      | 13.1           | 13.4          | 13.1           | 13.1         |
| cta         | 9.8            | 9.8           | 9.8            | 9.8          |
| **total**   | **141.1**      | **160.2**     | **129.0**      | **157.1**    |

No HTTP errors (no 429s), console errors or page errors in any run. No long task over 100 ms. Main
thread p95 16.8 ms, worst single frame 100 ms (at 390). Offline made no outside requests. The tour page
loaded in 63–111 ms.

## The one moment a judge will remember

The Proof Chain tamper: entry #42 cracks red, the sweep stops at it with "Hash mismatch at entry #42 ·
signature invalid", console, meter and caption agree, and Restore turns the chain green. It worked
perfectly offline (run 2). In both online runs the judge never sees it (problem 1). Runner-up: the
Q-Day film, where "₹332.03 kavya.menon@bharat…" decrypts in orange while the QuantumLedger lane stays
sealed.

## What broke or felt slow

1. **Online, the ledger demo skips its key moment and contradicts itself.** The shared database
   (`apps/web/.data`) has about 38,000 entries. "Verify the chain" takes 9.2 s for 37,745 entries; the
   film doesn't wait for the result and jumps from verify to restore, so tamper and detection never
   show. The 3D then says "ALL LINKS VERIFIED" while the console shows `REJECT 9234.8 ms ✗` and the
   meter "Chain broken at #37745". Real bug: `LedgerDemo.tsx:368` passes `ids.indexOf(broken.id)`, which
   is -1 when the break is outside the blocks on screen, and `LedgerFilm.tsx:537` treats -1 as intact.
   The slowness is data size: offline (about 140 entries) verified in 20 ms.
2. **Online, the first step fails and holds for 45 s.** The diagnostics sweep showed "TAMPER DETECTED ·
   Entry #37979 is signed by an unknown key" until the tour's 45 s limit. Likely cause: three servers
   shared one SQLite file, and `DbKeyStore.open` (`lib/live/keystore.ts`) loads signing keys only at
   startup, so keys another process made are unknown. A setup artefact, but the tour has no recovery.
3. **The 3D draws at 30 fps; the stage label says "LIVE WEBGL · 60 FPS".** 48–51% of frames had draws
   in every 3D step while the page ran at 60. The label (`StageFrame.tsx` `useFps`) counts animation
   frames, not draws. Particles, arcs and the ledger sweep visibly step next to 60 fps captions.
4. **The presenter badge covers content at 1440** (top right, every page): demo subtitles, the hero's
   Merkle graphic and "SECURED" chip, the top of the diagnostics stage.
5. **Overlapping labels.** Q-Day: the QuantumLedger anchor label and "ADVERSARY STORAGE" chip sit on the
   caption; at Q-Day "2036" overlaps "DECRYPTED · Q-DAY ESTIMATE" and the ₹332.03 line. Diagnostics
   terminal timestamps run into the op column. Impact: the risk band covers "Today · 2026".
6. **At 390:** Q-Day's 3D labels clip at the left edge; the QR panel overflows left with "CLOSE · Q" over
   the code (and a phone user is asked to scan a QR); the diagnostics mismatch label runs off the
   right; the red failed-diagnostics 3D shows behind the hero headline.
7. **"Skip to content" covered the logo** 2.5 s into the hero in run 1a (not seen again).
8. **The Index caption disagrees with the screen:** "49% already use a quantum-safe lock" stays while
   the counter says "82% still prove who they are with a key a quantum computer could forge" and the
   big "51%" never changes. The toggles the tour clicks are under the tour bar.
9. **Smaller:** during the tamper shot the meter still says "Chain verified"; Q-Day's storage chip
   shows 0 records while the console logs seals; the tour ends on an empty early-access form with the
   presenter badge still up; it runs 2:09–2:40 against a "3-minute" billing.

## What a non-technical judge wouldn't understand

- The tour opens on diagnostics (HNDL_RISK, KEX_GROUP, SHOR_EXPOSURE, Mosca X+Y vs Z, HKDF-SHA256, a
  zsh terminal) before anything is explained. Opening on the hero's lock analogy would help, plus a
  plain explanation of "(sim)".
- Demo pages: harvest-now-decrypt-later, Q-Day, CBOM, ML-DSA-65, Merkle root, checkpoint.
- Index: 51% and 49% look contradictory, then 82% appears.
- Impact: "41–46 years of exposure", "≈96 vs ≈6 engineer-weeks", "10,00,000" next to "1000000".
- Deploy: "1/5 fintech systems sealed", a raw JSON envelope, "18.2% of a 100 ms request".

## Five hardest judge questions

1. **"Is this real or an animation?"** The crypto is real: ML-KEM-768 + X25519 hybrid and ML-DSA-65
   from `@noble/post-quantum` 0.7.1 (`packages/core`). The ledger is a real SHA3-256 chain in SQLite
   with ML-DSA-signed entries; "tamper" edits the row and verify recomputes every hash and signature
   (`lib/live/ledger.ts`). What's simulated is labelled "(sim)": patched TLS settings, the adversary's
   recorded traffic, the Q-Day break; the classical lane uses a ~40-bit RSA key the browser really
   factors (`QDayDemo.tsx`). Don't claim 60 fps until the Driver fix ships.
2. **"Where do the India numbers come from?"** A real TLS handshake on 443 offering X25519MLKEM768
   first, recording the group and certificate key the server picks (`app/api/scan/url/route.ts`),
   aggregated over 91 reachable sites. Know the scan date ("scanned 2026-10-12") and how sites were
   chosen; admit most of the 49% is CDNs with hybrid PQ on by default.
3. **"What about my bank's site, not badssl?"** The tour uses a labelled cached example so it works
   offline (`EXAMPLE_DOMAIN`, `pipeline.ts`). A typed domain gets a locked-down live probe: https only,
   ports 443/80, public addresses only, 5 s and 1 MB caps, no HTTP request, 10 scans/min and 100/day.
   Detect and score are real; "fix" is a recommendation plus a simulated rescan.
4. **"What stops an insider rewriting the whole chain?"** Entries and checkpoints are ML-DSA-65 signed;
   the key is wrapped by a KEK outside the database (`loadKek`, `keystore.ts`), so re-hashing after an
   edit still fails the signature. Honestly: someone with the database and the KEK can forge; the
   answer is an HSM/KMS or external checkpoint anchoring. A full sweep is O(n), about 245 µs per entry;
   checkpoints bound routine sweeps.
5. **"Why not wait for OpenSSL, browsers or CDNs?"** CDNs are already upgrading TLS. QuantumLedger
   covers what TLS doesn't: data at rest, records that must stay secret 10–50 years, tamper-evident
   audit trails, with one adapter per system. The meter shows about 21 µs and 1.8 KB per seal. Have a
   one-line RBI / CERT-In answer ready.

## Before demo day

- One server per data directory, started fresh, with a small ledger (or verify from the last
  checkpoint). Rehearse once online on that machine.
- Fix the -1 → "All links verified" bug.
- Make the fps label count real draws, or remove it.
- Move or shrink the presenter badge.
- Make the tour skip or retry a failed diagnostics sweep instead of holding it for 45 s.

## Side effects of this rehearsal

The phone seals wrote real join messages and ledger entries to `.data` (shared by :3000, :3300,
:3400) and `.data-offline`; the tour tampered with and restored entry #42 on both.
