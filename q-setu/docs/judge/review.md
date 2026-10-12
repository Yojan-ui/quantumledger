# Judge review: the one-click tour

Recorded and measured with `node scripts/judge-tour.mjs` against the production build, in system Chrome
on an Apple M4 (ANGLE Metal, the real GPU path; not software rendering).

| File                                       | What it is                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| [`tour-1440.webm`](tour-1440.webm)         | The whole tour at 1440×900 (98.6 s), with a phone joining during step 2 |
| [`tour-390.webm`](tour-390.webm)           | The same tour on a 390×844 phone viewport (98.6 s)                      |
| [`metrics.json`](metrics.json)             | Final pass: per-step frame rate, INP and the interactions behind it     |
| [`metrics-pass1.json`](metrics-pass1.json) | First pass, before the review's fixes                                   |

During step 2 a second, phone-sized browser opens `/join`, makes its own key pair, and seals a real
message; the tour waits for it. Frame rate is measured in separate unrecorded runs (video capture
costs frames). INP comes from real (trusted) taps and clicks: the copy toggle, the index measures,
the calculator, a site scan, Demo 1's Next, the ledger's Verify, and a phone's emoji and "Seal & send".

## The tour

| #   | Step                             | Starts | What the judge sees                                                                  |
| --- | -------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| 1   | Hero, then the four-step analogy | 0 s    | One line, the globe and the QR; then locks → master key → copied boxes → new locks   |
| 2   | Phone join                       | 13.9 s | A large QR; the phone's message arcs from an Indian city to the glass Setu core      |
| 3   | India Quantum Readiness Index    | 18.5 s | Five sector bars rise out of India; the measure switches to RSA-2048 and back        |
| 4   | Q-Day                            | 34.2 s | Recorded traffic; the time-lapse; classical records open, Q-Setu records stay sealed |
| 5   | Deploy anywhere                  | 47.5 s | The globe descends on a system; one adapter seals it; the whole sector follows       |
| 6   | Ledger tamper                    | 61.4 s | An insider edits #42; verification stops there; restore; every link verifies         |
| 7   | Impact calculator                | 75.6 s | Secrecy of 10, 30 and then 50 years against the 2030–2035+ risk window               |
| 8   | Call to action                   | 88.5 s | Pilot partners and the early-access form                                             |

The button says "3-minute tour". With a phone joining promptly it takes 1 min 39 s; if nobody joins,
step 2 waits its full 20 s and the tour takes about 1 min 55 s.

## Answers, as a judge

### Could a non-technical person explain Q-Setu after the tour?

Yes, in roughly these words: _"People can copy our locked data today and keep it until a quantum
computer can open it. Q-Setu adds new locks that quantum computers can't open, to the systems we
already have, with one line of setup. About half of India's public sites already use one."_

What makes that possible:

- The analogy strip (locks, a master key that's coming, thieves copying boxes, new locks on the same
  doors) is now part of the tour's first step. In pass 1 the tour skipped it.
- Simple mode is the default, and every caption is plain. In pass 1 the films' own captions were
  technical ("…sealed with ML-KEM") under a plain tour caption; every shot now has a Simple version too.
- The two moments that do the explaining are concrete: a copy that opens at Q-Day (step 4), and a
  quiet edit that's caught (step 6).

What still asks something of them: the impact calculator's timeline needs a sentence of narration
the first time ("blue is how long it must stay secret, red is the part a quantum computer could read").

### What's the one memorable moment?

The phone. A judge scans the code, taps an emoji, and their own message arcs across India onto the
big screen ("Sealed by Visitor 3 · 1,152 B · 4.50 ms"). Then "Try to tamper" flips one bit, and the
same arc snaps red and shatters, while their phone says why: `aes-gcm: invalid tag`. It's real crypto
they ran themselves: the key pair was generated on their phone, and the server's ✓ is a receipt
their phone opened with its own key.

### Does anything feel slow?

Measured, no. Final pass, both viewports:

| Viewport | Frame rate, every step | Worst p95 frame | Frames over 33 ms | INP (slowest interaction) | Interactions ≥ 100 ms |
| -------- | ---------------------- | --------------- | ----------------- | ------------------------- | --------------------- |
| 1440×900 | 60 fps                 | 16.8 ms         | ≤ 0.1 %           | 48 ms                     | 0 of 39               |
| 390×844  | 60 fps                 | 16.8 ms         | 0 %               | 64 ms                     | 0 of 33               |

Targets: INP under 100 ms and 60 fps. Both are met at both sizes. Felt, two things:

- **Step 2 is a deliberate pause.** In a room it's the point; on a solo laptop it's 20 s of a QR code.
  → (or "Skip →") moves on at once.
- **The first ledger verify after a server start** waits for the background signature warm-up
  (about 30 s, once per process; see `docs/demos/review.md`). Start the server a minute before judging.

### Is every number cited or labelled as an estimate?

| Number on screen                                        | Status                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Live ticker, ops/sec, seal/open/verify times            | Measured live, on this server or in this browser                               |
| Room labels (bytes, ms) and the audience counter        | Measured: bytes on the wire, the phone's own seal time, the server's open time |
| Readiness Index shares, sector counts, 91 of 100        | Measured once by `pnpm index:build`; scan date, method and client shown        |
| Index headline ("51% …") and tour caption ("49% …")     | Computed from the same data, never typed in                                    |
| 2030 / 2035 (analogy, calculator)                       | Cited: NIST IR 8547 initial public draft, footnoted, called a draft            |
| Calculator: default secrecy years, exposure, effort     | Labelled "Estimate"; the effort assumptions are editable                       |
| Demo values (handshake sizes, ledger ids, Q-Day counts) | Measured from the real operations                                              |
| Solution pages: "data lifetime"                         | Now labelled "typical; an estimate"                                            |

Fixed in this review: the fintech impact line said "7–10 years" with no source, and now just says
"years". The What's-new card said "100 sites" as typed text, and now reads the count from the index data.

## Fixed between pass 1 and pass 2

| Weak point (pass 1)                                                              | Fix                                                                                 |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| The join step waited 20 s even when a phone had sealed (110.6 s tour)            | The tour counts the room's own "sealed" events from the start of the step (98.6 s)  |
| Film captions were technical in Simple mode                                      | Every shot has a Simple caption (≤ 12 words); the HUD follows the toggle            |
| The tour never showed the analogy strip                                          | Step 1 shows the hero, then the four steps                                          |
| On a phone the demo stage sat below the fold; judges saw controls, not the film  | The tour scrolls each film's stage into view                                        |
| On a phone the Index bars were below the list                                    | The globe comes first on narrow screens; bar labels abbreviate and stagger          |
| A "Skip to content" link showed after each page change                           | The tour clears the focus Next.js leaves on the skip link                           |
| Changing page to an anchor flashed the hero, then scrolled the whole page        | The tour jumps straight to the section on a new page, and glides only within a page |
| Unsourced "7–10 years"; typed "100 sites"; tour caption's "of 100 … 49%" (of 91) | Removed; read from data; reworded to "of 91 we reached" (after the final recording) |

Pass 1 and pass 2 have the same frame rate (60 fps) and INP (48 / 64 ms). The fixes are about what
a judge sees, not speed. An earlier, unsaved run before the pass-1 build measured 80 ms INP on the
phone. Moving the remaining main-thread crypto into workers came before pass 1.

## Deviations from the brief

- **Springs without Framer Motion.** The spring (stiffness 400, damping 30, mass 1) is sampled into a
  CSS `linear()` easing for every transition, and integrated in JS for the card tilt. It's the same
  motion with no animation library in the bundle.
- **Simple mode keeps one acronym line.** The brief's verbatim "What we didn't invent: ML-KEM and
  ML-DSA are NIST standards (FIPS 203/204)…" shows in both modes.
- **Emoji.** The design lint bans emoji in JSX. The phone's eight emoji live in `data/room.ts` and are
  user content; only those exact emoji are ever shown on the big screen, never free text.
- **The Index route.** Next.js reserves an app route named `index`, so the page lives at
  `/readiness-index` and `/index` is a rewrite to it.
- **The Setu core** is a small glass gem on the Q-Setu node (Mumbai). Its iridescence is subtle, and
  depends on the GPU.

## Gates

| Gate                   | Result                                             |
| ---------------------- | -------------------------------------------------- |
| `pnpm lint:design`     | ✓                                                  |
| `pnpm lint`            | ✓                                                  |
| `pnpm test`            | 115/115 ✓                                          |
| `pnpm build`           | ✓                                                  |
| Playwright e2e         | 47/47 ✓                                            |
| Home initial JS        | 167.1 KB gzip (budget 250 KB; was 154.1 KB)        |
| `/demo/deploy` page JS | 48.6 kB (the certificate flow now loads on demand) |
