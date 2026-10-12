"""QuantumLedger: PQC migration probe, hybrid remediation evidence and proof log.

Real:
* CBOM: a CycloneDX 1.6 document listing the cryptographic assets of the
  target connection (OIDs, primitives, NIST quantum security levels).
* Remediation evidence: X25519MLKEM768 hybrid key exchange (X25519 from
  `cryptography`, ML-KEM-768 from liboqs; shared secret = ML-KEM ss ‖ X25519 ss,
  as in draft-ietf-tls-ecdhe-mlkem) and ML-DSA-65 sign + verify over the
  transcript hash, timed on this machine (median of several runs).
* Proof ledger: RFC 6962-style SHA-256 Merkle tree (leaf = H(0x00‖data),
  node = H(0x01‖l‖r)). After every append the root is signed with Ed25519 and
  ML-DSA-65 and both signatures are verified; the newest leaf's inclusion
  proof is recomputed and checked against the root.

Modelled (and labelled as such in the UI): the target's "legacy RSA-2048 /
TLS 1.2" terminator and the "OpenSSL 3.5 hybrid terminator" deployment. The
measured operations are what such a deployment would run.
"""

from __future__ import annotations

import hashlib
import json
import statistics
import threading
import time
import uuid
from datetime import datetime, timezone

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from aether.pqc_native import ALG_ML_DSA_65, PqcNative

RUNS = 15


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


# ----------------------------------------------------------------------------- CBOM

def _alg(name: str, oid: str | None, primitive: str, functions: list[str], nist_q: int, classical: int,
         param: str | None = None, ref: str | None = None) -> dict:
    props: dict = {"primitive": primitive, "executionEnvironment": "software-plain-ram", "cryptoFunctions": functions,
                   "classicalSecurityLevel": classical, "nistQuantumSecurityLevel": nist_q}
    if param:
        props["parameterSetIdentifier"] = param
    comp = {"type": "cryptographic-asset", "name": name, "bom-ref": ref or f"crypto/{name.lower()}",
            "cryptoProperties": {"assetType": "algorithm", "algorithmProperties": props}}
    if oid:
        comp["cryptoProperties"]["oid"] = oid
    return comp


def cbom(posture: str) -> dict:
    """CycloneDX 1.6 CBOM for the target connection in the given posture ('legacy' | 'hybrid')."""
    legacy = posture == "legacy"
    common = [
        _alg("AES-256-GCM", "2.16.840.1.101.3.4.1.46", "ae", ["encrypt", "decrypt"], 1, 256, "256"),
        _alg("SHA-256", "2.16.840.1.101.3.4.2.1", "hash", ["digest"], 2, 128),
        _alg("SHA3-256", "2.16.840.1.101.3.4.2.8", "hash", ["digest"], 2, 128, ref="crypto/sha3-256"),   # order digest
    ]
    if legacy:
        assets = [
            _alg("RSA-2048", "1.2.840.113549.1.1.1", "signature", ["sign", "verify"], 0, 112, "2048"),
            _alg("X25519", "1.3.101.110", "key-agree", ["keygen", "keyderive"], 0, 128),
            {"type": "cryptographic-asset", "name": "TLS 1.2", "bom-ref": "crypto/protocol/tls12",
             "cryptoProperties": {"assetType": "protocol", "protocolProperties": {"type": "tls", "version": "1.2"}}},
        ]
    else:
        assets = [
            _alg("X25519MLKEM768", None, "kem", ["keygen", "encapsulate", "decapsulate"], 3, 128,
                 ref="crypto/x25519mlkem768"),
            _alg("ML-KEM-768", "2.16.840.1.101.3.4.4.2", "kem", ["keygen", "encapsulate", "decapsulate"], 3, 192, "768"),
            _alg("X25519", "1.3.101.110", "key-agree", ["keygen", "keyderive"], 0, 128),
            _alg("ML-DSA-65", "2.16.840.1.101.3.4.3.18", "signature", ["keygen", "sign", "verify"], 3, 192, "65"),
            {"type": "cryptographic-asset", "name": "TLS 1.3", "bom-ref": "crypto/protocol/tls13",
             "cryptoProperties": {"assetType": "protocol", "protocolProperties": {
                 "type": "tls", "version": "1.3", "cryptoRefArray": ["crypto/x25519mlkem768", "crypto/ml-dsa-65"]}}},
        ]
    return {
        "bomFormat": "CycloneDX", "specVersion": "1.6", "serialNumber": f"urn:uuid:{uuid.uuid4()}", "version": 1,
        "metadata": {
            "timestamp": _now_iso(),
            "tools": {"components": [{"type": "application", "name": "QuantumLedger CII probe"}]},
            "component": {"type": "application", "name": "aetherpool-order-entry", "bom-ref": "target",
                          "description": f"dark pool order-entry endpoint, {posture} posture"},
        },
        "components": assets + common,
        "dependencies": [{"ref": "target", "dependsOn": [c["bom-ref"] for c in assets + common]}],
    }


# ---------------------------------------------------------------------- Merkle log

def _leaf(data: bytes) -> bytes:
    return hashlib.sha256(b"\x00" + data).digest()


def _node(l: bytes, r: bytes) -> bytes:
    return hashlib.sha256(b"\x01" + l + r).digest()


def _mth(leaves: list[bytes]) -> bytes:
    """RFC 6962 Merkle Tree Hash over leaf hashes."""
    if not leaves:
        return hashlib.sha256(b"").digest()
    if len(leaves) == 1:
        return leaves[0]
    k = 1
    while k * 2 < len(leaves):
        k *= 2
    return _node(_mth(leaves[:k]), _mth(leaves[k:]))


def _path(m: int, leaves: list[bytes]) -> list[bytes]:
    """RFC 6962 audit path for leaf m."""
    if len(leaves) <= 1:
        return []
    k = 1
    while k * 2 < len(leaves):
        k *= 2
    if m < k:
        return _path(m, leaves[:k]) + [_mth(leaves[k:])]
    return _path(m - k, leaves[k:]) + [_mth(leaves[:k])]


def _verify_inclusion(m: int, n: int, leaf: bytes, path: list[bytes], root: bytes) -> bool:
    """RFC 9162 §2.1.3.2 inclusion proof verification."""
    if m >= n:
        return False
    fn, sn, r = m, n - 1, leaf
    for p in path:
        if sn == 0:
            return False
        if fn & 1 or fn == sn:
            r = _node(p, r)
            if not fn & 1:
                while fn and not fn & 1:
                    fn >>= 1; sn >>= 1
        else:
            r = _node(r, p)
        fn >>= 1; sn >>= 1
    return sn == 0 and r == root


class QuantumLedger:
    def __init__(self, native: PqcNative) -> None:
        self.native = native
        self.lock = threading.Lock()
        self.ed = Ed25519PrivateKey.generate()
        self.ed_pub = self.ed.public_key()
        self.dsa_pk, self.dsa_sk = native.sig_keypair(ALG_ML_DSA_65)
        self.leaves: list[bytes] = []
        self.entries: list[dict] = []

    # -- ledger ----------------------------------------------------------------
    def append(self, kind: str, record: dict) -> dict:
        data = json.dumps({"kind": kind, **record}, sort_keys=True, separators=(",", ":")).encode()
        with self.lock:
            leaf = _leaf(data)
            self.leaves.append(leaf)
            n = len(self.leaves)
            root = _mth(self.leaves)
            t0 = time.perf_counter_ns(); ed_sig = self.ed.sign(root); t1 = time.perf_counter_ns()
            dsa_sig = self.native.sign_msg(ALG_ML_DSA_65, self.dsa_sk, root); t2 = time.perf_counter_ns()
            try:
                self.ed_pub.verify(ed_sig, root); ed_ok = True
            except Exception:
                ed_ok = False
            dsa_ok = self.native.verify_msg(ALG_ML_DSA_65, self.dsa_pk, root, dsa_sig)
            incl = _verify_inclusion(n - 1, n, leaf, _path(n - 1, self.leaves), root)
            entry = {
                "index": n - 1, "ts": _now_iso(), "kind": kind, "leaf": leaf.hex(), "root": root.hex(), "size": n,
                "ed25519": {"bytes": len(ed_sig), "sign_ns": t1 - t0, "ok": ed_ok, "head": ed_sig[:8].hex()},
                "mldsa65": {"bytes": len(dsa_sig), "sign_ns": t2 - t1, "ok": dsa_ok, "head": dsa_sig[:8].hex()},
                "inclusion_ok": incl, "summary": record.get("summary", ""),
            }
            self.entries.append(entry)
            return entry

    def snapshot(self, limit: int = 100) -> dict:
        with self.lock:
            return {"size": len(self.leaves), "root": _mth(self.leaves).hex() if self.leaves else None,
                    "entries": self.entries[-limit:],
                    "keys": {"ed25519_pk": self.ed_pub.public_bytes(serialization.Encoding.Raw,
                                                                    serialization.PublicFormat.Raw).hex(),
                             "mldsa65_pk_bytes": len(self.dsa_pk)}}

    # -- remediation evidence --------------------------------------------------
    def _hybrid_kex(self) -> tuple[int, bool, int, int]:
        """One X25519MLKEM768 exchange; returns (ns, secrets match, client share B, server share B)."""
        n = self.native
        t0 = time.perf_counter_ns()
        c_x = X25519PrivateKey.generate()
        c_kpk, c_ksk = n.kem_keypair(768)
        c_xpub = c_x.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
        client_share = c_kpk + c_xpub                                 # ML-KEM ek ‖ X25519 public
        s_x = X25519PrivateKey.generate()
        ct, s_kss = n.kem_encaps(768, client_share[:len(c_kpk)])
        s_xss = s_x.exchange(X25519PublicKey.from_public_bytes(client_share[len(c_kpk):]))
        s_xpub = s_x.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
        server_share = ct + s_xpub                                    # ML-KEM ct ‖ X25519 public
        c_kss = n.kem_decaps(768, c_ksk, server_share[:len(ct)])
        c_xss = c_x.exchange(s_x.public_key())
        derive = lambda ss: HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=b"X25519MLKEM768").derive(ss)
        ok = derive(c_kss + c_xss) == derive(s_kss + s_xss)
        return time.perf_counter_ns() - t0, ok, len(client_share), len(server_share)

    def remediate(self) -> dict:
        kex, sv, ok_k, ok_s = [], [], True, True
        cs = ss_ = 0
        for _ in range(RUNS):
            ns, ok, cs, ss_ = self._hybrid_kex()
            kex.append(ns); ok_k &= ok
            transcript = hashlib.sha256(str(time.time_ns()).encode()).digest()
            t0 = time.perf_counter_ns()
            sig = self.native.sign_msg(ALG_ML_DSA_65, self.dsa_sk, transcript)
            good = self.native.verify_msg(ALG_ML_DSA_65, self.dsa_pk, transcript, sig)
            sv.append(time.perf_counter_ns() - t0); ok_s &= good
        metrics = {
            "kex_ns": int(statistics.median(kex)), "sign_verify_ns": int(statistics.median(sv)), "runs": RUNS,
            "sig_bytes": len(sig), "pk_bytes": len(self.dsa_pk), "client_share": cs, "server_share": ss_,
            "kex_ok": ok_k, "sig_ok": ok_s,
        }
        doc = cbom("hybrid")
        doc_hash = hashlib.sha256(json.dumps(doc, sort_keys=True).encode()).hexdigest()
        entry = self.append("FR-4 hybrid remediation", {
            "endpoint": "aetherpool-order-entry", "group": "X25519MLKEM768", "sig": "ML-DSA-65",
            "metrics": metrics, "cbom_sha256": doc_hash,
            "summary": f"X25519MLKEM768 + ML-DSA-65 verified · kex {metrics['kex_ns'] / 1e6:.2f} ms · "
                       f"sign+verify {metrics['sign_verify_ns'] / 1e6:.2f} ms",
        })
        return {"metrics": metrics, "cbom_sha256": doc_hash, "entry": entry}
