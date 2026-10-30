"""Tie-break priority stage (tiebreak/): equal scores, every key tied, dependency order and cycles, patch choice,
determinism, the CLI + ledger pickup, and the results.json schema."""

import json
import random
from pathlib import Path

import jsonschema
import pytest

from tiebreak import prioritise, uses_of

REPO = Path(__file__).resolve().parent.parent
CFG = json.loads((REPO / "config" / "tiebreak.json").read_text())


def asset(aid, *, score=5.0, week=1, shelf=1.0, alg="ECC[kex,sig]", kind="service_mtls", deps=(), effort=2.0):
    return {"id": aid, "name": aid, "kind": kind, "algorithm": alg, "shelf_life_years": shelf, "effort_days": effort,
            "risk_weight": score, "depends_on": list(deps), "planned_week": week, "evidence": []}


def schedule(*assets):
    return {"assumptions": {"start_year": 2027.0, "weeks_per_year": 52,
                            "scenarios": [{"name": "Z2032", "year": 2032.0, "weight": 0.5}, {"name": "Z2030", "year": 2030.0, "weight": 0.5}]},
            "assets": list(assets)}


def order(sec):
    return [b["id"] for w in sec["waves"] for b in w["batches"]]


def by_id(sec):
    return {b["id"]: b for w in sec["waves"] for b in w["batches"]}


def test_higher_score_first_without_a_tie():
    sec = prioritise(schedule(asset("a", score=3), asset("b", score=9)), CFG)
    assert order(sec) == ["b", "a"]
    assert sec["tie_groups"] == 0
    assert all(b["tie"] is None and b["decided_by"] == "score" for b in by_id(sec).values())


def test_equal_scores_broken_by_mosca_margin():
    # same score, same week: the data that must stay secret longer goes first
    sec = prioritise(schedule(asset("short", shelf=0.5), asset("long", shelf=7.0)), CFG)
    assert order(sec) == ["long", "short"]
    b = by_id(sec)
    assert b["long"]["decided_by"] == "mosca_margin_years" and "Mosca margin" in b["long"]["why"]
    # earliest scenario Z2030: z = 3 y; long: 7 + 1/52 - 3 > 0 (exposed)
    assert sec["threat"] == {"scenario": "Z2030", "z_years_to_qday": 3.0, "rule": "earliest"}
    assert b["long"]["mosca"]["exposed"] is True and b["short"]["mosca"]["exposed"] is False
    assert sec["tie_groups"] == 1


def test_secondary_keys_in_order():
    # Mosca ties -> HNDL (key exchange) -> internet-facing -> dependents -> effort
    sec = prioritise(schedule(asset("sig-only", alg="RSA[sig]"), asset("kex", alg="ECC[kex]")), CFG)
    assert order(sec) == ["kex", "sig-only"] and by_id(sec)["kex"]["decided_by"] == "hndl_exposed"
    sec = prioritise(schedule(asset("internal"), asset("edge", kind="tls_gateway")), CFG)
    assert order(sec) == ["edge", "internal"] and by_id(sec)["edge"]["decided_by"] == "internet_facing"
    sec = prioritise(schedule(asset("big", effort=9), asset("small", effort=1)), CFG)
    assert order(sec) == ["small", "big"] and by_id(sec)["small"]["decided_by"] == "effort_days"
    # dependents count: c (in a later week) depends on "core", so core has more dependents
    sec = prioritise(schedule(asset("leaf"), asset("core"), asset("c", week=2, deps=["core"])), CFG)
    assert order(sec)[:2] == ["core", "leaf"] and by_id(sec)["core"]["decided_by"] == "dependents"


def test_all_keys_tied_falls_back_to_stable_id():
    sec = prioritise(schedule(asset("zeta"), asset("alpha"), asset("mid")), CFG)
    assert order(sec) == ["alpha", "mid", "zeta"]
    b = by_id(sec)
    assert b["alpha"]["decided_by"] == "id" and b["zeta"]["decided_by"] == "id"
    assert all(x["tie"]["size"] == 3 for x in b.values())


def test_dependency_goes_first_even_against_the_keys():
    # "app" would win on Mosca, but it depends on "db" in the same tie group: db is patched first
    sec = prioritise(schedule(asset("app", shelf=9.0, deps=["db"]), asset("db", shelf=0.1)), CFG)
    assert order(sec) == ["db", "app"]
    b = by_id(sec)
    assert b["db"]["decided_by"] == "dependency" and b["db"]["why"] == "app depends on it"
    assert b["app"]["why"] == "after db, which it depends on"


def test_dependency_cycle_is_broken_deterministically():
    s = schedule(asset("a", deps=["b"], shelf=2.0), asset("b", deps=["a"], shelf=5.0), asset("c", deps=["a"]))
    sec = prioritise(s, CFG)
    assert sorted(order(sec)) == ["a", "b", "c"] and len(order(sec)) == 3  # every batch exactly once
    assert sec["dependency_cycles"] == 1
    assert all(x["tie"]["dependency_cycle"] for x in by_id(sec).values())
    assert order(prioritise(s, CFG)) == order(sec)  # same input, same order


@pytest.mark.parametrize("alg,expected", [
    ("ECC[kex]", ["kex"]), ("RSA[sig]", ["sig"]), ("ECC[kex,sig]", ["kex", "sig"]), ("RSA[sig]+ECC[kex]", ["kex", "sig"]),
])
def test_uses_parsed_from_algorithm(alg, expected):
    assert uses_of({"algorithm": alg}) == expected


def test_patches_follow_what_the_asset_uses():
    b = by_id(prioritise(schedule(asset("k", alg="ECC[kex]"), asset("s", alg="RSA[sig]", score=4), asset("both", score=3)), CFG))
    names = CFG["patches"]
    assert b["k"]["patches"] == [names["kex"]]
    assert b["s"]["patches"] == [names["sig"]]
    assert b["both"]["patches"] == [names["kex"], names["sig"]]  # ML-KEM first (HNDL)


def test_order_does_not_depend_on_input_order():
    assets = [asset(f"x{i}", score=float(i % 3), week=1 + i % 2, shelf=float(i % 4), effort=float(i % 5),
                    kind="vpn" if i % 6 == 0 else "service_mtls", deps=[f"x{i - 1}"] if i % 4 == 0 and i else [])
              for i in range(18)]
    ref = order(prioritise(schedule(*assets), CFG))
    for seed in range(5):
        shuffled = assets[:]
        random.Random(seed).shuffle(shuffled)
        assert order(prioritise(schedule(*shuffled), CFG)) == ref
    assert len(ref) == len(set(ref)) == 18


def test_config_must_end_with_id():
    with pytest.raises(ValueError, match="must be 'id'"):
        prioritise(schedule(asset("a")), {**CFG, "keys": ["mosca_margin_years", "effort_days"]})


def test_cli_writes_section_manifest_and_ledger_picks_it_up(tmp_path):
    from ledger.ingest import run_manifests
    from tiebreak.__main__ import main

    sched = tmp_path / "schedule.json"
    sched.write_text(json.dumps(schedule(asset("b"), asset("a"))))
    out, runs = tmp_path / "out", tmp_path / "runs"
    assert main(["--schedule", str(sched), "--out-dir", str(out), "--runs", str(runs)]) == 0
    sec = json.loads((out / "tiebreak.json").read_text())
    assert (runs / sec["run_id"] / "manifest.json").exists()
    assert ("tiebreak.run", runs / sec["run_id"] / "manifest.json") in run_manifests(out, runs)
    schema = json.loads((REPO / "contracts" / "results.schema.json").read_text())
    jsonschema.validate(sec, {"$schema": schema["$schema"], "$defs": schema["$defs"], "$ref": "#/$defs/tiebreak"})


def test_demo_inventory_schedule_validates():
    demo = REPO / "out" / "schedule.json"
    if not demo.exists():
        pytest.skip("out/schedule.json not present (run ./run_demo.sh)")
    s = json.loads(demo.read_text())
    sec = prioritise(s, CFG)
    planned = [a["id"] for a in s["assets"] if a.get("planned_week") is not None]
    assert sorted(order(sec)) == sorted(planned)
    weeks = [w["week"] for w in sec["waves"]]
    assert weeks == sorted(weeks)
