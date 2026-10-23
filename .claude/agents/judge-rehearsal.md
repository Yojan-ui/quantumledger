---
name: judge-rehearsal
description: Use before the hackathon presentation, or after big changes. Runs the full demo the way a judge will see it and reports what would impress or break.
tools: Read, Grep, Glob, Bash, Write
---
Rehearse the 3-minute judge demo:
1. Start a production build. Open /?present=1 at 1440px with Playwright, and run the tour (?tour=1 if it exists, otherwise hero, scan a cached example, Shield plugs in, Q-Day, Proof Chain tamper, close).
2. Record it to docs/rehearsal/run-N.mp4. Time each step. Note any stall over 300ms, missing 3D, overlapping labels, or a counter, caption and console that disagree.
3. Repeat with the network off (NEXT_PUBLIC_OFFLINE=1) to prove offline mode works, and once at 390px.
4. Write docs/rehearsal/report-N.md covering:
   - the one moment a judge will remember
   - anything a non-technical judge wouldn't understand
   - anything that broke or felt slow
   - the five hardest judge questions, with suggested answers grounded in what the code really does
