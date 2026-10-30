"""Live TLS endpoint scan: public hosts only, one ordinary TLS handshake each (detect.live_probe), no port scanning.

parse() accepts host[:port] (default 443, one port per host, at most MAX_HOSTS hosts); resolve_public() refuses
localhost and any host with a private, loopback, link-local, reserved or multicast address (every resolved address
is checked, and the probe connects to the checked address with the hostname as SNI). write_manifests() gives each
endpoint a service directory whose ownership fields are labelled assumptions; findings() turns one handshake into
Detect evidence (host, field, value) so the endpoint enters the inventory like any scanned service.
"""

import ipaddress
import json
import re
import socket
from pathlib import Path

from cryptography import x509

from .static_scan import describe_public_key

MAX_HOSTS = 10
HOST_RE = re.compile(r"^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$")
CERT = re.compile(r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", re.S)
# Ownership facts a handshake cannot reveal; shown as assumptions and editable in the workspace manifest.
ASSUMED = {"kind": "public_tls_endpoint", "data_class": "customer_pii"}
ASSUMPTION_NOTE = ("ASSUMPTION: each scanned host is a public_tls_endpoint carrying customer_pii (shelf life, risk and "
                   "effort from config/assumptions.json; edit atlas-service.json to change it). Nothing is changed on the "
                   "host: it has no lab stand-in, so its waves are planned and not_verified_in_lab.")


class EndpointError(ValueError):
    pass


def parse(items) -> list[tuple[str, int]]:
    out: dict[str, int] = {}
    for item in items or []:
        text = str(item).strip().lower().rstrip(".")
        if not text:
            continue
        if m := re.fullmatch(r"\[([0-9a-f:.]+)\](?::(\d*))?", text):  # [IPv6]:port
            host, port = m.group(1), m.group(2) or ""
        elif text.count(":") == 1:
            host, _, port = text.partition(":")
        else:
            host, port = text, ""
        if "/" in text or "@" in text or not (port == "" or port.isdigit()):
            raise EndpointError(f"{item!r}: enter a hostname, optionally with :port (no scheme, path or credentials)")
        p = int(port) if port else 443
        if not 1 <= p <= 65535:
            raise EndpointError(f"{item!r}: port must be 1-65535")
        if host == "localhost" or host.endswith((".localhost", ".local", ".internal", ".lan", ".home.arpa")):
            raise EndpointError(f"{host}: local and internal names are refused")
        if _ip(host) is None and not HOST_RE.match(host):
            raise EndpointError(f"{item!r}: not a valid public hostname")
        if host in out and out[host] != p:
            raise EndpointError(f"{host}: one port per host (no port scanning)")
        out[host] = p
    if not out:
        raise EndpointError("enter at least one public hostname")
    if len(out) > MAX_HOSTS:
        raise EndpointError(f"at most {MAX_HOSTS} hosts per scan")
    return list(out.items())


def _ip(text: str):
    try:
        return ipaddress.ip_address(text.strip("[]"))
    except ValueError:
        return None


def resolve_public(host: str, port: int, resolver=socket.getaddrinfo) -> str:
    """The first resolved address, after checking that every address is globally routable."""
    if (ip := _ip(host)) is not None:
        addrs = [ip]
    else:
        try:
            addrs = [ipaddress.ip_address(a[4][0].split("%")[0]) for a in resolver(host, port, type=socket.SOCK_STREAM)]
        except (OSError, UnicodeError) as e:
            raise EndpointError(f"{host}: could not resolve ({e.__class__.__name__})") from None
    if not addrs:
        raise EndpointError(f"{host}: no address")
    for a in addrs:
        if not a.is_global or a.is_multicast:
            raise EndpointError(f"{host}: resolves to a private or internal address ({a}); only public hosts are scanned")
    return str(addrs[0])


def service_id(host: str, port: int) -> str:
    sid = re.sub(r"[^a-z0-9]+", "-", host.lower()).strip("-")[:56]
    return sid if port == 443 else f"{sid}-{port}"


def write_manifests(src: Path, endpoints: list[tuple[str, int]]) -> list[str]:
    """One service directory per endpoint; returns runner probe strings SERVICE=HOST:PORT."""
    probes = []
    for host, port in endpoints:
        sid = service_id(host, port)
        d = src / sid
        d.mkdir(parents=True, exist_ok=True)
        (d / "atlas-service.json").write_text(json.dumps({
            "id": sid, "name": f"{host}:{port}", **ASSUMED, "depends_on": [],
            "endpoint": f"{host}:{port}", "source": "live_tls_scan", "assumption": ASSUMPTION_NOTE}, indent=1))
        probes.append(f"{sid}={host}:{port}")
    return probes


def chain(transcript: str) -> list[dict]:
    """Certificates the server sent (s_client -showcerts), leaf first: key type and size, signature, expiry."""
    out = []
    for m in CERT.finditer(transcript):
        try:
            c = x509.load_pem_x509_certificate(m.group(0).encode())
        except ValueError:
            continue
        family, algo = describe_public_key(c.public_key())
        out.append({"subject": c.subject.rfc4514_string(), "issuer": c.issuer.rfc4514_string(), "key_family": family,
                    "key": algo, "signature_algorithm": c.signature_algorithm_oid._name,
                    "not_after": c.not_valid_after_utc.isoformat()})
    return out


def findings(sid: str, live: dict, certs: list[dict]) -> list[dict]:
    """Detect evidence for one handshake: line 1 = key exchange, line 2.. = each certificate in the chain."""
    if not live.get("handshake_ok"):
        return []
    file = f"{sid}/tls/{live['endpoint']}"
    group = live.get("group") or "none (RSA key transport)"
    out = [{
        "file": file, "line": 1, "rule": "live-tls-kex", "rules": ["live-tls-kex"], "family": live.get("kex_family") or "UNKNOWN",
        "use": "kex", "confidence": "high",
        "snippet": f"{live['endpoint']} key_exchange={group} protocol={live.get('protocol')} cipher={live.get('cipher')}",
        "detail": {"host": live["endpoint"], "field": "key_exchange_group", "value": group,
                   "class": "hybrid post-quantum" if live.get("kex_family") == "PQC" else "classical",
                   "protocol": live.get("protocol"), "cipher": live.get("cipher")},
    }]
    for i, c in enumerate(certs):
        role = "leaf" if i == 0 else f"chain[{i}]"
        out.append({
            "file": file, "line": i + 2, "rule": "live-tls-cert", "rules": ["live-tls-cert"], "family": c["key_family"],
            "use": "sig", "confidence": "high",
            "snippet": f"{live['endpoint']} {role} key={c['key']} signature={c['signature_algorithm']} not_after={c['not_after'][:10]}",
            "detail": {"host": live["endpoint"], "field": f"certificate.{role}", "value": c["key"], **c},
        })
    return out
