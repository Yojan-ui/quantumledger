"""python -m tiebreak [--schedule out/schedule.json] [--out-dir out] [--runs runs] [--config config/tiebreak.json]

Writes out/tiebreak.json and runs/<run_id>/manifest.json (input/output SHA-256), which `python -m ledger ingest`
signs as tiebreak.run. Deterministic: no randomness, no network. See tiebreak/__init__.py for the algorithm.
"""

import argparse
import json
import sys
from pathlib import Path

from contracts.manifest import new_run_id, sha256_json, utc_now

from . import prioritise

REPO = Path(__file__).resolve().parent.parent


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m tiebreak", description=__doc__.splitlines()[0])
    ap.add_argument("--schedule", type=Path, default=REPO / "out" / "schedule.json")
    ap.add_argument("--out-dir", type=Path, default=REPO / "out")
    ap.add_argument("--runs", type=Path, default=REPO / "runs")
    ap.add_argument("--config", type=Path, default=REPO / "config" / "tiebreak.json")
    args = ap.parse_args(argv)
    schedule = json.loads(args.schedule.read_text())
    cfg = json.loads(args.config.read_text())
    section = prioritise(schedule, cfg)
    run_id = new_run_id()
    out = {"run_id": run_id, "ts": utc_now(), "schedule_sha256": sha256_json(schedule), "config_sha256": sha256_json(cfg), **section}
    out["output_sha256"] = sha256_json({k: v for k, v in out.items() if k not in ("run_id", "ts")})
    d = args.runs / run_id
    d.mkdir(parents=True, exist_ok=True)
    (d / "manifest.json").write_text(json.dumps({"stage": "tiebreak", **out}, indent=1))
    args.out_dir.mkdir(parents=True, exist_ok=True)
    (args.out_dir / "tiebreak.json").write_text(json.dumps(out, indent=1))
    n = sum(len(w["batches"]) for w in section["waves"])
    print(f"tiebreak run {run_id}: {n} batches in {len(section['waves'])} waves, {section['tie_groups']} tie groups resolved"
          f"{f', {section['dependency_cycles']} dependency cycle(s) broken' if section['dependency_cycles'] else ''}"
          f" (Q-day {section['threat']['scenario']}, z = {section['threat']['z_years_to_qday']:g} y)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
