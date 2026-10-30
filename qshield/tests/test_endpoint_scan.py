"""Scan a live endpoint: host validation (public only, one port per host), handshake -> Detect evidence -> inventory,
and the POST /api/workspaces/<id>/endpoints route. Recorded handshakes in tests/fixtures/tls (no network)."""

import json
import socket
from pathlib import Path

import pytest

from detect import __main__ as detect_main
from detect import endpoint_scan as es
from detect.live_probe import parse_transcript
from tiebreak import uses_of

from .atlas_web_helpers import PASSWORD, Client, start_server

TLS = Path(__file__).parent / "fixtures" / "tls"
PUBLIC = {"www.cloudflare.com": "104.16.123.96", "www.wikipedia.org": "185.15.59.224", "badssl.com": "104.154.89.105"}


def fake_resolver(table):
    def resolve(host, port, type=None):
        if host not in table:
            raise socket.gaierror("unknown")
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (a, port)) for a in table[host]]
    return resolve


def test_parse_defaults_and_refusals():
    assert es.parse(["Example.COM", "api.example.com:8443", "example.com"]) == [("example.com", 443), ("api.example.com", 8443)]
    for bad in (["localhost"], ["https://example.com"], ["user@example.com"], ["example.com/x"], ["db.internal"],
                ["example.com:0"], ["example.com:abc"], [], ["printer.local"]):
        with pytest.raises(es.EndpointError):
            es.parse(bad)
    with pytest.raises(es.EndpointError, match="one port per host"):
        es.parse(["example.com:443", "example.com:8443"])
    with pytest.raises(es.EndpointError, match="at most"):
        es.parse([f"h{i}.example.com" for i in range(es.MAX_HOSTS + 1)])


@pytest.mark.parametrize("addrs", [["10.0.0.5"], ["127.0.0.1"], ["169.254.169.254"], ["192.168.1.1"], ["104.16.1.1", "172.16.0.1"],
                                   ["::1"], ["fd00::1"], ["100.64.0.1"], ["224.0.0.1"]])
def test_private_and_internal_addresses_refused(addrs):
    with pytest.raises(es.EndpointError, match="private or internal"):
        es.resolve_public("rebind.example.com", 443, resolver=fake_resolver({"rebind.example.com": addrs}))


def test_public_address_and_ip_literals():
    assert es.resolve_public("x.example.com", 443, resolver=fake_resolver({"x.example.com": ["104.16.1.1"]})) == "104.16.1.1"
    assert es.resolve_public("1.1.1.1", 443) == "1.1.1.1"  # literal: no DNS lookup
    with pytest.raises(es.EndpointError):
        es.resolve_public("10.1.2.3", 443)
    with pytest.raises(es.EndpointError, match="could not resolve"):
        es.resolve_public("nx.example.com", 443, resolver=fake_resolver({}))


def _record(host):
    text = (TLS / f"{host}.txt").read_text()
    return text, {"endpoint": f"{host}:443", "handshake_ok": True, **parse_transcript(text)}


def test_handshake_fields_from_recorded_transcripts():
    _, cf = _record("www.cloudflare.com")
    assert (cf["protocol"], cf["group"], cf["kex_family"]) == ("TLSv1.3", "X25519MLKEM768", "PQC")
    _, wp = _record("www.wikipedia.org")
    assert (wp["group"], wp["kex_family"], wp["kex_quantum_vulnerable"]) == ("X25519", "ECC", True)
    text, bs = _record("badssl.com")
    assert bs["protocol"] == "TLSv1.2" and bs["cipher"] == "ECDHE-RSA-AES128-GCM-SHA256"
    certs = es.chain(text)
    assert len(certs) >= 2 and certs[0]["key"].startswith("RSA-") and certs[0]["signature_algorithm"]
    assert all(c["not_after"][:4].isdigit() for c in certs)
    f = es.findings("badssl-com", bs, certs)
    assert [x["line"] for x in f] == list(range(1, len(certs) + 2))
    assert f[0]["use"] == "kex" and f[0]["detail"]["field"] == "key_exchange_group" and f[0]["detail"]["class"] == "classical"
    assert all(x["use"] == "sig" and x["detail"]["host"] == "badssl.com:443" for x in f[1:])
    assert es.findings("x", {"handshake_ok": False, "endpoint": "x:443"}, []) == []


def test_live_inventory_end_to_end_in_detect(tmp_path, monkeypatch):
    src, runs = tmp_path / "src", tmp_path / "runs"
    probes = es.write_manifests(src, [(h, 443) for h in PUBLIC])
    monkeypatch.setattr(es, "resolve_public", lambda host, port, resolver=None: PUBLIC[host])
    calls = []

    def fake_probe(addr, port, transcript_dir=None, label="", timeout=20, servername=None):
        calls.append((addr, port, servername, timeout))
        text, rec = _record(servername)
        transcript_dir.mkdir(parents=True, exist_ok=True)
        (transcript_dir / f"probe_{label}.txt").write_text(text)
        return {**rec, "address": addr}

    monkeypatch.setattr(detect_main, "probe", fake_probe)
    parsed = dict(detect_main.parse_probe(p) for p in probes)
    section, inv = detect_main.run(src, parsed, runs, probe_timeout=5, live_inventory=True)
    assert sorted(calls) == sorted((PUBLIC[h], 443, h, 5) for h in PUBLIC)  # connect to the checked address, SNI = name
    assert inv["label"].startswith("Live TLS scan, ") and "ASSUMPTION" in inv["label"]
    by = {a["id"]: a for a in inv["assets"]}
    # Cloudflare negotiates hybrid ML-KEM: only its certificates need migrating (ML-DSA); the others need both
    assert uses_of(by["www-cloudflare-com"]) == ["sig"]
    assert uses_of(by["www-wikipedia-org"]) == ["kex", "sig"] and uses_of(by["badssl-com"]) == ["kex", "sig"]
    assert all(a["kind"] == "public_tls_endpoint" and a["data_class"] == "customer_pii" for a in inv["assets"])
    assert section["summary"]["vulnerable_findings"] > 0 and section["drift_count"] == 0
    assert {p["service"] for p in section["probes"]} == {es.service_id(h, 443) for h in PUBLIC}
    assert all(p["live"]["chain"] for p in section["probes"])


def test_live_inventory_refuses_a_host_that_now_resolves_private(tmp_path, monkeypatch):
    src = tmp_path / "src"
    es.write_manifests(src, [("rebind.example.com", 443)])

    def private(host, port, resolver=None):
        raise es.EndpointError(f"{host}: resolves to a private or internal address (10.0.0.1)")

    monkeypatch.setattr(es, "resolve_public", private)
    monkeypatch.setattr(detect_main, "probe", lambda *a, **k: pytest.fail("must not connect"))
    section, inv = detect_main.run(src, {"rebind-example-com": ("rebind.example.com", 443)}, tmp_path / "runs", live_inventory=True)
    assert inv["assets"] == [] and section["probes"][0]["drift"][0]["kind"] == "probe_failed"


@pytest.fixture
def server(monkeypatch, tmp_path):
    srv = start_server(monkeypatch, tmp_path)
    srv.app.store.create_user("op", PASSWORD, "operator")
    srv.app.store.create_user("vic", PASSWORD, "viewer")
    yield srv
    srv.shutdown()
    srv.server_close()


def test_endpoints_route(server, monkeypatch):
    real = es.resolve_public
    monkeypatch.setattr(es, "resolve_public", lambda h, p, resolver=None: real(h, p, resolver=fake_resolver(
        {"www.cloudflare.com": ["104.16.123.96"], "intranet.example.com": ["10.0.0.7"]})))
    port = server.server_address[1]
    vic = Client(port)
    vic.login("vic")
    op = Client(port)
    op.login("op")
    assert op.post("/api/workspaces", {"id": "tls", "name": "Live TLS scan", "template": "empty"})[0] == 201
    url = "/api/workspaces/tls/endpoints"
    assert vic.post(url, {"hosts": ["www.cloudflare.com"], "authorised": True})[0] == 403
    assert op.post(url, {"hosts": ["www.cloudflare.com"]})[1]["error"]["code"] == "not_authorised"
    for hosts in (["localhost"], ["127.0.0.1"], ["intranet.example.com"], ["a.example.com:443", "a.example.com:22"]):
        st, body = op.post(url, {"hosts": hosts, "authorised": True})
        assert (st, body["error"]["code"]) == (422, "bad_endpoint"), hosts
    st, body = op.post(url, {"hosts": ["www.cloudflare.com"], "authorised": True})
    assert st == 200 and body["probes"] == ["www-cloudflare-com=www.cloudflare.com:443"] and body["label"].startswith("Live TLS scan, ")
    manifest = json.loads((Path(server.app.store.path).parent / "workspaces/tls/src/www-cloudflare-com/atlas-service.json").read_text())
    assert manifest["source"] == "live_tls_scan" and "ASSUMPTION" in manifest["assumption"]
    assert op.post(url, {"hosts": ["www.cloudflare.com"], "authorised": True})[1]["error"]["code"] == "rate_limited"
    from atlas_web import workspaces as wsmod
    from atlas_web.runner import pipeline_steps

    detect = dict(pipeline_steps(wsmod.get(server.app.store, "tls"), []))["detect"]
    assert "--live-inventory" in detect and detect[detect.index("--probe") + 1] == "www-cloudflare-com=www.cloudflare.com:443"
    assert op.post("/api/workspaces/demo/endpoints", {"hosts": ["www.cloudflare.com"], "authorised": True})[0] == 403
