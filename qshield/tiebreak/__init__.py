"""Tie-break priority: inside each wave of the plan, which batch (system) is patched first, and with what.

The schedule (QpiAI Opt MILP) decides the week of every system. Inside a week, batches are ordered by their
vulnerability score (Atlas's risk_weight, an assumption from config/assumptions.json). When two or more batches
in the same week have the SAME score, this stage decides the order, deterministically and explainably:

  hard rule  a batch another tied batch depends on is patched before it (topological order; a dependency
             cycle is broken by the keys below and recorded as such)
  then, lexicographically (config/tiebreak.json "keys", no weights):
   1 mosca_margin_years  x + y - z, larger first. Mosca's inequality: data that must stay secret x years,
                         migrated y years from the start, is exposed if x + y > z (years to Q-day). This is the
                         same exposure Atlas's scheduler minimises: e = max(0, x + t - (Z - start_year)).
   2 hndl_exposed        uses classical key exchange (traffic recorded today can be read later) first
   3 internet_facing     reachable from the internet first (config/tiebreak.json kinds; an assumption)
   4 dependents          more systems (transitively) depending on it first
   5 effort_days         less effort first (a quick, safe patch before a long one)
   6 id                  stable id, so no tie is ever left unresolved

Patches per batch come from what it actually uses (the algorithm column, e.g. "ECC[kex,sig]"): key exchange ->
ML-KEM, signatures -> ML-DSA, both -> ML-KEM first (config "patches.order", with the reason).
No randomness, no clock: the same schedule and config always give the same order.
"""

from __future__ import annotations

import re
from heapq import heappop, heappush

KEY_LABELS = {
    "mosca_margin_years": "Mosca margin",
    "hndl_exposed": "harvest-now-decrypt-later exposure",
    "internet_facing": "internet-facing",
    "dependents": "systems depending on it",
    "effort_days": "migration effort",
    "id": "stable id",
}


def uses_of(asset: dict) -> list[str]:
    """'ECC[kex,sig]' / 'RSA[sig]+ECC[kex]' -> ['kex', 'sig'] (what the asset uses the vulnerable crypto for)."""
    found = set()
    for part in re.findall(r"\[([^\]]*)\]", asset.get("algorithm") or ""):
        found |= {u.strip() for u in part.split(",") if u.strip()}
    if not found:  # fall back to the evidence's use field
        for e in asset.get("evidence") or []:
            u = e.get("use")
            found |= {"kex", "sig"} if u == "both" else ({u} if u else set())
    if "both" in found:
        found = (found - {"both"}) | {"kex", "sig"}
    return sorted(found & {"kex", "sig"})


def dependents_count(assets: list[dict]) -> dict[str, int]:
    """How many assets (transitively) depend on each asset. Cycle-safe: a node never counts itself."""
    rev: dict[str, set[str]] = {a["id"]: set() for a in assets}
    for a in assets:
        for d in a.get("depends_on") or []:
            if d in rev:
                rev[d].add(a["id"])
    out = {}
    for aid in rev:
        seen, stack = set(), list(rev[aid])
        while stack:
            n = stack.pop()
            if n in seen or n == aid:
                continue
            seen.add(n)
            stack.extend(rev.get(n, ()))
        out[aid] = len(seen)
    return out


def threat_years(assumptions: dict, cfg: dict) -> tuple[float, str]:
    """z: years from the plan start to the Q-day scenario named by the config rule (earliest by default)."""
    scen = assumptions.get("scenarios") or []
    if not scen:
        raise ValueError("assumptions have no Q-day scenarios")
    rule = (cfg.get("threat_scenario") or {}).get("rule", "earliest")
    if rule != "earliest":
        raise ValueError(f"unknown threat_scenario rule {rule!r}")
    s = min(scen, key=lambda x: x["year"])
    return float(s["year"]) - float(assumptions["start_year"]), s["name"]


def _keys(b: dict, order: list[str]) -> tuple:
    """Sort key: smaller sorts first, so 'larger first' keys are negated."""
    k = []
    for name in order:
        v = b["keys"][name]
        k.append(v if name in ("effort_days", "id") else -float(v))
    return tuple(k)


def _reason(first: dict, second: dict, order: list[str]) -> tuple[str, str]:
    """(key, one-line reason) why `first` goes before `second` in a tie."""
    if second["id"] in first.get("_needed_by", set()):
        return "dependency", f"{second['id']} depends on it"
    for name in order:
        a, b = first["keys"][name], second["keys"][name]
        if a == b:
            continue
        if name == "mosca_margin_years":
            return name, f"data stays secret longer past Q-day: Mosca margin {a:+.2f} y vs {b:+.2f} y ({second['id']})"
        if name == "hndl_exposed":
            return name, f"uses classical key exchange (harvest-now-decrypt-later exposed); {second['id']} does not"
        if name == "internet_facing":
            return name, f"internet-facing; {second['id']} is internal"
        if name == "dependents":
            return name, f"{a} systems depend on it vs {b} for {second['id']}"
        if name == "effort_days":
            return name, f"smaller patch: {a:g} vs {b:g} engineer-days ({second['id']})"
        return "id", f"all other keys tie with {second['id']}; stable id order"
    return "id", f"identical to {second['id']} on every key; stable id order"


def _order_group(group: list[dict], order: list[str]) -> tuple[list[dict], bool]:
    """Topological order inside a tie group (dependency first), ties by the keys; breaks cycles by the keys."""
    ids = {b["id"] for b in group}
    by_id = {b["id"]: b for b in group}
    pre = {b["id"]: {d for d in b["depends_on"] if d in ids and d != b["id"]} for b in group}
    for b in group:
        b["_needed_by"] = {x for x, ds in pre.items() if b["id"] in ds}
    left, out, cycle = dict(pre), [], False
    ready: list = []
    for i, ds in left.items():
        if not ds:
            heappush(ready, (_keys(by_id[i], order), i))
    done: set[str] = set()
    while len(out) < len(group):
        if not ready:  # a cycle: take the best-ranked remaining batch and carry on
            cycle = True
            rest = [i for i in left if i not in done]
            i = min(rest, key=lambda x: (_keys(by_id[x], order), x))
            heappush(ready, (_keys(by_id[i], order), i))
        _, i = heappop(ready)
        if i in done:
            continue
        done.add(i)
        out.append(by_id[i])
        for j, ds in left.items():
            if j not in done and i in ds:
                ds = ds - {i}
                left[j] = ds
                if not ds:
                    heappush(ready, (_keys(by_id[j], order), j))
    return out, cycle


def prioritise(schedule: dict, cfg: dict) -> dict:
    """The tie-break section for out/tiebreak.json (without run_id / ts / hashes)."""
    order = list(cfg["keys"])
    if order[-1] != "id":
        raise ValueError("the last tie-break key must be 'id' so that no tie stays unresolved")
    assumptions = schedule["assumptions"]
    wpy = float(assumptions.get("weeks_per_year", 52))
    z, zname = threat_years(assumptions, cfg)
    edge = set((cfg.get("internet_facing_kinds") or {}).get("kinds", []))
    patch_names, patch_order = cfg["patches"], cfg["patches"]["order"]
    deps = dependents_count(schedule["assets"])
    batches = []
    for a in schedule["assets"]:
        week = a.get("planned_week")
        if week is None:
            continue
        uses = uses_of(a)
        x, y = float(a["shelf_life_years"]), float(week) / wpy
        batches.append({
            "id": a["id"], "name": a.get("name", a["id"]), "week": int(week), "score": float(a["risk_weight"]),
            "kind": a.get("kind"), "uses": uses, "depends_on": list(a.get("depends_on") or []),
            "patches": [patch_names[u] for u in patch_order if u in uses],
            "mosca": {"x_shelf_life_years": x, "y_migration_years": round(y, 6), "z_years_to_qday": z, "exposed": x + y > z},
            "keys": {
                "mosca_margin_years": round(x + y - z, 6),
                "hndl_exposed": int("kex" in uses),
                "internet_facing": int(a.get("kind") in edge),
                "dependents": deps.get(a["id"], 0),
                "effort_days": float(a["effort_days"]),
                "id": a["id"],
            },
        })
    waves, rank, ties, cycles = [], 0, 0, 0
    for week in sorted({b["week"] for b in batches}):
        in_week = [b for b in batches if b["week"] == week]
        ordered = []
        for score in sorted({b["score"] for b in in_week}, reverse=True):
            group = sorted((b for b in in_week if b["score"] == score), key=lambda b: b["id"])
            if len(group) == 1:
                group[0]["tie"] = None
                group[0]["why"] = "only batch with this vulnerability score in its wave"
                group[0]["decided_by"] = "score"
                ordered.append(group[0])
                continue
            ties += 1
            seq, cyc = _order_group(group, order)
            cycles += cyc
            for i, b in enumerate(seq):
                nxt = seq[i + 1] if i + 1 < len(seq) else None
                b["tie"] = {"size": len(seq), "position": i + 1, "with": [x["id"] for x in seq if x is not b], "dependency_cycle": cyc}
                if nxt:
                    b["decided_by"], b["why"] = _reason(b, nxt, order)
                else:
                    key, _ = _reason(seq[i - 1], b, order)
                    prev = seq[i - 1]["id"]
                    b["decided_by"] = key
                    b["why"] = (f"after {prev}, which it depends on" if key == "dependency"
                                else f"after {prev}, which goes first on {KEY_LABELS.get(key, key)}")
            ordered.extend(seq)
        rows = []
        for b in ordered:
            rank += 1
            b.pop("_needed_by", None)
            rows.append({"rank": rank, **b})
        waves.append({"week": week, "batches": rows})
    return {
        "label": "Tie-break priority: inside each wave, equal vulnerability scores are ordered by Mosca's margin, then HNDL exposure, internet exposure, dependents, effort and a stable id. Keys, kinds and the Q-day choice are assumptions (config/tiebreak.json).",
        "method": "lexicographic keys after a dependency-first topological order",
        "keys": [{"key": k, "label": KEY_LABELS[k]} for k in order],
        "threat": {"scenario": zname, "z_years_to_qday": z, "rule": cfg["threat_scenario"]["rule"]},
        "patch_rule": {"order": patch_order, "names": {k: patch_names[k] for k in ("kex", "sig")}, "note": cfg["patches"]["note"]},
        "assumptions_label": "assumption",
        "tie_groups": ties,
        "dependency_cycles": cycles,
        "waves": waves,
    }
