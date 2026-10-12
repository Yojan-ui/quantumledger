# Cinematic demos: review

Before: `docs/demos/before/` (commit `007e83e`, the demos as they were). After: `docs/demos/after/`. Each demo was recorded
in autoplay at 1440×900 by `node scripts/record-demos.mjs <dir>`, against the production build.

| Demo             | Before | After  | What the recording does                                                  |
| ---------------- | ------ | ------ | ------------------------------------------------------------------------ |
| 1 · How it works | 37.0 s | 34.6 s | Play (six shots), then Attack it                                         |
| 2 · Deploy       | 35.1 s | 23.3 s | Play: survey, descend, target, integrate (a real deploy), deploy all     |
| 3 · Q-Day        | 28.0 s | 21.9 s | Go to Q-Day: record, time-lapse, climax (the real attack), aftermath     |
| 4 · Q-Ledger     | 45.6 s | 76.6 s | Play: verify, tamper #42, verify (break found), restore and verify again |

Demo 4 is longer because it now runs the whole sequence, including a final verify, and every verify is real (see "Known
issue" below).

Crypto, backend and demo logic are unchanged. Every shot runs the same real operations as before (handshake steps,
adapter deploys, the Q-Day factoring, ledger verify, tamper and restore); the director only decides where the camera is
and when the next shot may start.

## The test: "what is happening to the data right now?"

Every caption is one line of 12 words or fewer, and is shown only while its shot is on screen.

### Demo 1 · How it works (`HandshakeFilm`)

| Shot      | Caption                                                               | Answers it? | Real work behind it                                                 |
| --------- | --------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------- |
| establish | Client and server share no secret yet; anything sent is public.       | ✓           | (none yet)                                                          |
| client    | The client creates a one-time X25519 key share.                       | ✓           | `clientHello`; the label shows the share's real hex                 |
| packet    | The ClientHello carries that share to the server, in the open.        | ✓           | Label: real ClientHello size                                        |
| server    | The server signs a fresh ML-KEM key; the client checks the signature. | ✓           | `serverRespond`, then `clientFinish` verify; ✓ only after it passes |
| merge     | Classical and post-quantum secrets merge through HKDF into one key.   | ✓           | `serverComplete`; label: real session ID                            |
| pullback  | Every message is now sealed with AES-256-GCM, in microseconds.        | ✓           | 14 real seal/open; label: measured msg/s and µs                     |
| attack    | A forged ML-KEM key fails the ML-DSA signature check.                 | ✓           | Forged ServerHello is really rejected                               |

### Demo 2 · Deploy (the site's globe)

| Shot      | Caption                                                          | Answers it?                                                                   |
| --------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| orbit     | This traffic can be recorded today and decrypted after Q-Day.    | ✓ (reworded: it said "Today … now", twice)                                    |
| descend   | Each saffron node is a {sector} system sending harvestable data. | ✓                                                                             |
| target    | {System}'s data still crosses the network under classical keys.  | ✓                                                                             |
| integrate | One adapter, and this system's traffic is sealed with ML-KEM.    | ✓ (a real deploy runs; the node only turns OK when it succeeds)               |
| all       | Every {sector} system now seals its traffic with ML-KEM.         | ✓ (each remaining node is really deployed; the counter reads the real states) |

### Demo 3 · Q-Day

| Shot      | Caption                                                      | Answers it?                                                                                      |
| --------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| split     | An adversary records both systems' encrypted traffic, today. | ✓                                                                                                |
| timelapse | Years pass; the recordings are kept, unreadable for now.     | ✓                                                                                                |
| climax    | Q-Day: classical keys fall, and the recorded data opens.     | ✓ (holds until the browser has really factored the keys; the labels show real decrypted records) |
| aftermath | Classical records are exposed; Q-Setu records stay sealed.   | ✓ (both counters are the real outcome counts)                                                    |

### Demo 4 · Q-Ledger

| Shot    | Caption                                                        | Answers it?                                                      |
| ------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| chain   | Each new entry is hashed and signed, chained to the last.      | ✓ (the newest blocks are real entries, refreshed as they arrive) |
| verify  | Verification re-hashes every entry and checks every signature. | ✓                                                                |
| tamper  | An insider edits entry #42 directly in the database.           | ✓                                                                |
| broken  | Verification stops at #{id}: {what it found}.                  | ✓ (fixed: see below)                                             |
| restore | The original row is restored; the whole chain verifies again.  | ✓                                                                |

**Fixed in review.** The "broken" caption was written as "stops at #42". In one recording the real verify broke somewhere
else (see the next section), and the film would have said #42 anyway. The caption now comes from the verify result: the
entry ID and the reason the server gave. The "Hash mismatch at entry #42" label appears only when the break really is
at #42.

**Removed in review.**

- Demo 3 showed three floating "Decrypted" labels at the climax. Two of them clipped at the stage edge on a laptop-width
  stage. It now shows two (one on phones), truncated to 24 characters.
- Demo 4 had a 3D label "Chain intact" that repeated the page's own result line. It is now "All links verified".
- Every anchored 3D label is `aria-hidden`. Each stage describes itself in its `aria-label`, and the page states each
  result in text.

## What was built

- **Director (`components/director/`):**
  - `useDirector`: shots, ← → Space R, and a minimum hold of 1.5 s.
  - `DirectorCamera`: an arc path eased with the motion token over 1.2–1.8 s, a 1.5° roll that settles to level, and a
    2–2.5% drift over 8 s while a shot is held.
  - `Anchor`: a 1px leader line, a mono label and a value. It fades in after the camera settles and out before it
    moves.
  - `DirectorHUD`: the caption with a mask reveal, a role-coloured step bar, and Prev / Next / Play / Replay.
  - `useFilm`: autoplay that advances only after the real work behind a shot finishes and the shot has been held. A Next
    pressed mid-flight is queued, not dropped. A detour (Attack it) cuts to its shot and comes back.
  - `useReactions`: real seal / verify / reject / rotate events ripple, pulse or snap the matching object.
- **Console:** `LiveConsole` highlights the log lines that belong to the current shot.
- **Demo 2 on the shared globe:** the world store gained a shot pose, land relief, a focused node with a dot model, a
  KEM ring that drops on a sealed node, and an 80 ms west-to-east wave. A GSAP tween drives the pose (an arc that lifts
  off the surface mid-flight). The node label is pinned to the node's screen position, and the adapter snippet types
  into it.

## Guardrails

- **Lighting:** one key light, a dim rim in the scene's role colour (KEM, WARN, SIG) and fog. No bloom, flares,
  starfields or chromatic aberration in the new scenes.
- **Q-Day background:** the time-lapse moves a backdrop plane from blue-black to warm-black, mixed in sRGB at 3–4.5%.
  Two attempts failed first. `scene.background` inside a drei View tinted the whole page. A linear-space mix glowed.
- **Focus pull:** shots with a subject dim and shrink everything else.
  - Real depth of field (postprocessing `EffectComposer`) would replace the shared canvas's render pass. That breaks
    every other View and the globe, so it isn't used.
  - Phones and reduced motion get no focus pull.
- **Reduced motion:** cuts between shots, with no drift, no breathing and no shatter animation. Scenes show their end
  states.
- **Performance:**
  - Scenes mount near the viewport and skip per-frame work off screen. DPR is capped at 1.75.
  - Phones get half the AES sparks, one Q-Day leak label and no focus pull.
  - GSAP loads with the first camera move.
  - Home initial JS: 154.1 KB (budget 250 KB).
- **Presenter mode:** Demos 1–3 start their film automatically, and ←/→/R still work. A manual key pauses autoplay and
  takes over. Text scales with `--type-scale`.
  - Demo 4 stays manual in presenter mode. Its punchline is the presenter choosing when to tamper, and autoplay would
    race their key presses.

## Deviations from the brief

- The time-lapse rolls 2026 → 2033, the demo's illustrative Q-Day, instead of 2026 → 2035. The slider still goes to 2035.
- Depth of field is faked by dimming, for the reason given under Guardrails.
- One e2e assertion changed. The presenter test pressed → on Q-Day and expected exactly 2027, but → now advances the
  film (a time-lapse), so it checks that the year has left 2026.

## Known issue (not caused by this change)

The local ledger has grown to about 12,500 entries from days of live traffic, and a full verify takes about 22 s on
this machine. Shots wait for real verification, so Demo 4's film waits too. Worth a follow-up, for example verifying
from the last signed checkpoint.

A second finding from the recordings: a stale second server process on the same `.data` directory, left from recording
the "before" videos, made verification report "signed by an unknown key". Each process caches its own key store. With
one server the chain verifies intact.

## Gates

| Gate                       | Result          |
| -------------------------- | --------------- |
| `pnpm lint` (incl. design) | ✓               |
| `pnpm test`                | 105/105 ✓       |
| `pnpm build`               | ✓               |
| Playwright e2e             | 41/41 ✓         |
| Home initial JS            | 154.1 KB gzip ✓ |

**60 fps:** this can't be measured here, because headless recording uses software rendering. The scenes are small: at
most 12 packets × 6 shards, 12 blocks, 48 sparks, and no transmission materials in the new films. Check on the
presentation machine.
