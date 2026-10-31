"""python -m detect [--root DIR] [--probe SERVICE=HOST:PORT ...] [--lab-probe SERVICE=MODE ...] [--live-inventory]

--lab-probe starts a temporary local lab TLS service in MODE (legacy | transition | strict, see
config/lab.json), probes it as SERVICE's live endpoint, and shuts it down.

-> out/detect.json (detect section of results.json) and out/inventory.json (input to schedule),
   probe transcripts in runs/<run_id>/.
"""

import argparse
import contextlib
import json
from pathlib import Path

from contracts.manifest import new_run_id, sha256_json, utc_now

from . import endpoint_scan
from .drift import compare
from .inventory import build_inventory, owner, service_dirs
from .live_probe import probe
from .static_scan import scan, summarize

REPO = Path(__file__).resolve().parent.parent
DEFAULT_ROOT = REPO / "detect" / "fixtures" / "mock_bank"


def run(root: Path, probes: dict[str, tuple[str, int]], run_dir: Path, probe_timeout: float = 20,
        live_inventory: bool = False) -> tuple[dict, dict]:
    """live_inventory: the probes are a live TLS endpoint scan (detect.endpoint_scan): each host is re-checked as
    public, probed at the checked address with its name as SNI, and its handshake becomes Detect evidence."""
    run_id = new_run_id()
    result = scan(root)
    dirs = service_dirs(root)
    by_id = {json.loads((d / "atlas-service.json").read_text())["id"]: prefix for prefix, d in dirs.items()}
    lives = {}
    for sid, (host, port) in probes.items():
        if live_inventory:
            try:
                addr = endpoint_scan.resolve_public(host, port)
            except endpoint_scan.EndpointError as e:
                lives[sid] = {"endpoint": f"{host}:{port}", "ts": utc_now(), "handshake_ok": False, "error": str(e)}
                continue
            addr = f"[{addr}]" if ":" in addr else addr
            live = probe(addr, port, transcript_dir=run_dir / run_id, label=sid, timeout=probe_timeout, servername=host)
            text = (run_dir / run_id / f"probe_{sid}.txt").read_text()
            live["chain"] = endpoint_scan.chain(text)
            result["findings"] += endpoint_scan.findings(sid, live, live["chain"])
        else:
            live = probe(host, port, transcript_dir=run_dir / run_id, label=sid, timeout=probe_timeout)
        lives[sid] = live
    if live_inventory:
        result["summary"] = summarize(result["findings"])
    inventory = build_inventory(root, result)
    if live_inventory:
        inventory["label"] = f"Live TLS scan, {utc_now()}: one TLS handshake per public host. {endpoint_scan.ASSUMPTION_NOTE}"
    probe_records = []
    for sid, live in lives.items():
        findings = [f for f in result["findings"] if owner(f["file"], dirs) == by_id.get(sid)]
        probe_records.append(compare(sid, findings, live))
    section = {
        "run_id": run_id,
        "ts": utc_now(),
        "scanned_root": result["root"],
        "tree_sha256": result["tree_sha256"],
        "files_scanned": result["files_scanned"],
        "summary": result["summary"],
        "findings": result["findings"],
        "probes": probe_records,
        "drift_count": sum(len(p["drift"]) for p in probe_records),
        "inventory": {
            "assets": len(inventory["assets"]),
            "not_vulnerable": [x["id"] for x in inventory["not_vulnerable"]],
            "unowned_findings": len(inventory["unowned_findings"]),
            "sha256": sha256_json(inventory),
        },
    }
    (run_dir / run_id).mkdir(parents=True, exist_ok=True)
    (run_dir / run_id / "manifest.json").write_text(json.dumps({k: section[k] for k in ("run_id", "ts", "scanned_root", "tree_sha256", "files_scanned", "inventory")}, indent=1))
    return section, inventory


def parse_probe(text: str) -> tuple[str, tuple[str, int]]:
    sid, _, endpoint = text.partition("=")
    host, _, port = endpoint.rpartition(":")
    return sid, (host, int(port))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    ap.add_argument("--probe", action="append", default=[], metavar="SERVICE=HOST:PORT")
    ap.add_argument("--lab-probe", action="append", default=[], metavar="SERVICE=MODE")
    ap.add_argument("--out-dir", type=Path, default=REPO / "out")
    ap.add_argument("--runs", type=Path, default=REPO / "runs")
    ap.add_argument("--live-inventory", action="store_true",
                    help="--probe endpoints are a live TLS endpoint scan: public hosts only, handshakes become inventory evidence")
    ap.add_argument("--probe-timeout", type=float, default=20, help="seconds per live probe; a timeout is recorded as probe_failed")
    args = ap.parse_args(argv)

    probes = dict(map(parse_probe, args.probe))
    with contextlib.ExitStack() as stack:
        if args.lab_probe:
            from capture.services import load_lab, managed_service

            lab = load_lab()
            for item in args.lab_probe:
                sid, _, mode = item.partition("=")
                svc = stack.enter_context(managed_service(f"probe-{sid}", mode, lab))
                probes[sid] = (svc.host, svc.port)
        section, inventory = run(args.root, probes, args.runs, args.probe_timeout, args.live_inventory)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    (args.out_dir / "detect.json").write_text(json.dumps(section, indent=1))
    (args.out_dir / "inventory.json").write_text(json.dumps(inventory, indent=1))
    s = section["summary"]
    print(f"scanned {section['files_scanned']} files: {s['vulnerable_findings']} vulnerable, {s['pqc_findings']} PQC findings")
    print(f"inventory: {section['inventory']['assets']} assets to migrate; not vulnerable: {section['inventory']['not_vulnerable']}")
    for p in section["probes"]:
        live = p["live"]
        print(f"probe {p['service']} {p['endpoint']}: group={live.get('group')} cert={live.get('cert_algorithm')} drift={[d['kind'] for d in p['drift']]}")


if __name__ == "__main__":
    main()
