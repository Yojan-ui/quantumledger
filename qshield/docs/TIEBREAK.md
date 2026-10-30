# Tie-break priority stage (`python -m tiebreak`)

Runs right after Plan (`contracts/stages.json`: detect → ledger → schedule → **tiebreak** → capture → gates →
qaoa → seal → report). It writes `out/tiebreak.json`, a run manifest that the ledger signs as `tiebreak.run`,
and the `tiebreak` section of `results.json` (schema: `$defs/tiebreak`).

## The question it answers

The QpiAI Opt MILP decides the week of every system. Inside a week, systems ("batches") are patched in order
of their vulnerability score (Atlas's `risk_weight`). When two or more batches in the same week have the
same score, something has to decide which one gets its ML-KEM (key exchange) or ML-DSA (signature) patch
first. Without a rule the order is arbitrary and changes between runs. This stage makes it deterministic and
explains every decision.

This is different from the MILP's own `schedule.milp.*.tiebreak` solve, which breaks ties between equally
optimal week assignments inside the optimiser. This stage orders batches inside a week after the plan is fixed.

## Algorithm

1. **Hard rule: dependencies first.** Inside a tie group, a batch that another tied batch depends on is
   patched first: a topological order (Kahn's algorithm) whose ready set is ordered by the keys below.
   A dependency cycle (the MILP prevents it, but inputs can contain one) is broken by taking the best-ranked
   remaining batch; this is recorded (`dependency_cycles`, `tie.dependency_cycle`).
2. **Lexicographic keys** (`config/tiebreak.json` `keys`; compared in order, no weights):
   1. **Mosca margin** `x + y − z`, larger first. From Mosca's inequality: data that must stay secret `x`
      years (shelf life), migrated `y` years from the plan's start (its completion week), is exposed if
      `x + y > z` (years to Q-day). It is the same quantity Atlas's scheduler minimises:
      `e = max(0, x + t − (Z − start_year))`. `z` uses the earliest Q-day scenario (the most conservative).
   2. **Harvest-now-decrypt-later exposure**: the batch uses classical key exchange, so traffic recorded
      today can be read later.
   3. **Internet-facing**: reachable from the internet (asset kinds in `internet_facing_kinds`).
   4. **Dependents**: more systems (transitively) depending on it.
   5. **Effort**: fewer engineer-days first (a quick, safe patch before a long one).
   6. **Stable id**: always last, so no tie is ever left unresolved.
3. **Patches per batch** come from what the batch actually uses (the algorithm column, e.g. `ECC[kex,sig]`):
   key exchange → ML-KEM-768 (X25519MLKEM768 hybrid), signatures → ML-DSA-65, both → **ML-KEM first**.
   Recorded traffic protected by classical key exchange is exposed now (HNDL); a classical signature can only
   be forged by a quantum computer that exists at the time of the attack.

Each batch carries a one-line `why` (the first key on which it beats the next batch in its tie group, or the
dependency), `decided_by`, its key values and Mosca's numbers.

## Why this choice

- **Explainable**: every position is justified by exactly one named key, which a judge or auditor can check.
- **Deterministic**: no randomness or clock; shuffling the input gives the same order (tested).
- **Consistent with the plan**: the first key is the exposure the MILP itself minimises, so the in-week order
  follows the same risk model as the weeks.
- **Lexicographic, not weighted**: no weights to tune or defend; each key only matters when all earlier keys
  tie.
- Alternatives considered: a weighted score (needs weights that are pure assumptions, and is harder to
  explain); re-solving the MILP with a finer time grid (heavier, still needs a tie rule); random order (not
  reproducible).

## Assumptions (labelled "assumption" in the UI)

- The vulnerability score is Atlas's `risk_weight` (from `config/assumptions.json`).
- The key order, the internet-facing kinds, the ML-KEM-first rule and the choice of the earliest Q-day
  scenario for `z` are in `config/tiebreak.json`.

## Tests

`tests/test_tiebreak.py`: score order without ties, equal scores broken by each key in turn, all keys tied
(stable id), dependency first even against the keys, dependency cycles (each batch exactly once,
deterministic), patch choice from `kex`/`sig` use, order independent of input order, config validation, the
CLI and its pickup by `ledger ingest`, the schema, and the demo schedule.
