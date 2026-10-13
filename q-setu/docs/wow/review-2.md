# Wow pass: review 2

Same method as review 1, after its fixes: `node scripts/wow-shots.mjs after-2` and
`node scripts/wow-video.mjs after-2` (`attract-1440.webm`, `home-scroll-1440.webm`, `fps.json`).

## Is each Part 0 issue fixed?

Yes, all eight, as in review 1, re-checked in the after-2 shots at both widths. On phones (390):
- the hero's swarm fills the top half above the headline;
- the Analogy padlock, the How it works arc and the Index columns read clearly;
- the diagnostics stage keeps its labels inside it.

## Does each homepage section have a visibly different shot?

Yes. The table in review 1 still holds:
- hero sphere → node close-up pulling back → morphing analogy object → low angle over India → close on a
  city → side-on along an arc → orbit of five objects → wide pull-back.

On phones, Deploy anywhere now frames the active object dead centre (`home-390-s06-adapters.png`: the
shield with its lit `--kem` ring).

## Is there a moment in the first 10 seconds a judge would remember?

Yes. The particles of the lattice-cube mark burst into the red swarm, and the real pipeline turns it
green while "Fix it." and "Prove it." land on their stages (`attract-1440.webm`).

## Is any label or panel overlapping?

No:
- On phones the demo pill is now one row (step dots, arrows, Play, Replay), so nothing is clipped. With
  a 70svh stage it sits just below the first screen on a 390 × 844 phone, at the stage's bottom edge.
- The vault counter and every anchored label stay inside their stage.
- The console drawer sits in the stage's top-right corner, clear of the caption and the pill.

## Is anything below 50 fps?

No section is.
- Every homepage section scrolls at 60 fps with a p95 frame of 16.7–16.8 ms.
- Two long frames appeared in the recorded measurement: 66.7 ms in the opening (the 3D boot, 0.2% of its
  frames) and a single 283 ms frame in Solutions (0.4%; that section averaged 56 fps).
- The Solutions frame did not reproduce. Three more full 45 s scrolls had no long task and no frame over
  50 ms anywhere after the opening. It is reported here as measured.

## Pass 2 changes

None needed beyond review 1's two phone fixes, which are verified above.
