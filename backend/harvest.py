"""Harvest-Now-Decrypt-Later simulation over real captured order traffic.

The adversary's passive tap has recorded recent order-entry frames. We replay
that exact byte stream through three link configurations, let the adversary
store everything it can see, then fast-forward to "Q-day":

  1. CLEARTEXT       — no transport encryption. Nothing to break.
  2. X25519+AES-GCM  — classical ECDH session. A cryptographically relevant
                       quantum computer recovers the X25519 private scalar from
                       the harvested public share via Shor's algorithm. No such
                       machine exists, so the simulation substitutes an oracle
                       that hands over the private key — clearly labelled. The
                       decryption that follows is real.
  3. ML-KEM+AES-GCM  — FIPS 203 encapsulated session (liboqs). No known quantum
                       algorithm solves Module-LWE efficiently, so there is no
                       oracle to substitute. The adversary's best move is a
                       decapsulation under a guessed key; ML-KEM's implicit
                       rejection yields an unrelated secret and AES-GCM
                       authentication fails. That failure is real, not a label.
"""

from __future__ import annotations

import os
import time

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from aether import protocol as P
from aether.pqc_native import ALG_NAMES, PqcNative

SIDE = {0: "BUY", 1: "SELL"}
DUMP_BYTES = 256


def _kdf(secret: bytes, info: bytes) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=info).derive(secret)


def _split_frames(stream: bytes) -> list[bytes]:
    out, o = [], 0
    while o + 4 <= len(stream):
        n = int.from_bytes(stream[o:o + 4], "little")
        out.append(stream[o:o + 4 + n])
        o += 4 + n
    return out


def _exposed(stream: bytes, limit: int = 6) -> tuple[int, list[dict], int]:
    """Decode what an adversary learns from a recovered plaintext stream."""
    orders = [d for d in (P.decode_new_order(f) for f in _split_frames(stream)) if d]
    notional = sum(o.price * o.qty // P.SCALE for o in orders)
    sample = [
        {"id": o.oid, "desk": f"DESK-{o.participant:02d}", "side": SIDE[o.side], "px": P.fmt_px(o.price),
         "qty": P.fmt_qty(o.qty), "alg": ALG_NAMES.get(o.alg, "?")}
        for o in orders[:limit]
    ]
    return len(orders), sample, notional


def run(native: PqcNative, frames: list[bytes], kem_level: int = 768) -> dict:
    stream = b"".join(frames)
    if not stream:
        return {"ok": False, "reason": "the tap has not observed any order traffic yet"}
    aad = b"AETHERPOOL/order-entry/v1"
    nonce = os.urandom(12)
    channels = []

    # 1. CLEARTEXT --------------------------------------------------------------
    n, sample, notional = _exposed(stream)
    channels.append({
        "channel": "CLEARTEXT",
        "kex": "none",
        "handshake_bytes": 0,
        "harvested_bytes": len(stream),
        "ciphertext_head": stream[:32].hex(),
        "qday": {"status": "EXPOSED", "method": "none required — read directly off the wire",
                 "orders_recovered": n, "notional": P.fmt_notional(notional), "sample": sample},
    })

    # 2. X25519 + AES-256-GCM --------------------------------------------------
    t0 = time.perf_counter_ns()
    server = X25519PrivateKey.generate()
    client = X25519PrivateKey.generate()
    server_pub = server.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    client_pub = client.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    key = _kdf(client.exchange(server.public_key()), b"x25519")
    ct = AESGCM(key).encrypt(nonce, stream, aad)
    kex_us = (time.perf_counter_ns() - t0) / 1000
    harvested = {"server_pub": server_pub, "client_pub": client_pub, "ct": ct}

    # Q-day: SIMULATED CRQC ORACLE — stands in for Shor's algorithm on the harvested
    # public share. Everything after the oracle is ordinary, real decryption.
    oracle_scalar = server.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw,
                                         serialization.NoEncryption())
    recovered = X25519PrivateKey.from_private_bytes(oracle_scalar)
    k2 = _kdf(recovered.exchange(X25519PublicKey.from_public_bytes(harvested["client_pub"])), b"x25519")
    pt = AESGCM(k2).decrypt(nonce, harvested["ct"], aad)
    n, sample, notional = _exposed(pt)
    channels.append({
        "channel": "X25519 + AES-256-GCM",
        "ct_dump": ct[:DUMP_BYTES].hex(),          # what the tap stored
        "pt_dump": pt[:DUMP_BYTES].hex(),          # the same bytes after the (oracle-keyed) real decrypt
        "kex": "X25519 (classical ECDH)",
        "handshake_bytes": len(server_pub) + len(client_pub),
        "harvested_bytes": len(server_pub) + len(client_pub) + len(ct),
        "seal_us": round(kex_us, 1),
        "ciphertext_head": ct[:32].hex(),
        "qday": {"status": "EXPOSED",
                 "method": "SIMULATED CRQC ORACLE (stand-in for Shor's algorithm on the X25519 public share) → real AES-GCM decrypt",
                 "orders_recovered": n, "notional": P.fmt_notional(notional), "sample": sample},
    })

    # 3. ML-KEM + AES-256-GCM --------------------------------------------------
    t0 = time.perf_counter_ns()
    kem_pk, kem_sk = native.kem_keypair(kem_level)
    kem_ct, ss = native.kem_encaps(kem_level, kem_pk)
    key = _kdf(ss, b"ml-kem")
    ct = AESGCM(key).encrypt(nonce, stream, aad)
    kex_us = (time.perf_counter_ns() - t0) / 1000
    # Legitimate receiver round-trip check
    assert native.kem_decaps(kem_level, kem_sk, kem_ct) == ss

    # Q-day: no oracle exists for Module-LWE. Best effort: decapsulate under a guessed key.
    attempts, opened = 64, 0
    for _ in range(attempts):
        _, guess_sk = native.kem_keypair(kem_level)
        guess_ss = native.kem_decaps(kem_level, guess_sk, kem_ct)   # implicit rejection: pseudorandom
        try:
            AESGCM(_kdf(guess_ss, b"ml-kem")).decrypt(nonce, ct, aad)
            opened += 1
        except InvalidTag:
            pass
    channels.append({
        "channel": f"ML-KEM-{kem_level} + AES-256-GCM",
        "kex": f"ML-KEM-{kem_level} (FIPS 203)",
        "handshake_bytes": len(kem_pk) + len(kem_ct),
        "harvested_bytes": len(kem_pk) + len(kem_ct) + len(ct),
        "seal_us": round(kex_us, 1),
        "ciphertext_head": ct[:32].hex(),
        "qday": {"status": "SEALED" if opened == 0 else "EXPOSED",
                 "method": f"no quantum oracle for Module-LWE; {attempts} guessed-key decapsulations → AES-GCM tag rejected {attempts - opened}/{attempts}",
                 "orders_recovered": 0 if opened == 0 else None,
                 "nist_category": 3 if kem_level == 768 else 5},
    })

    return {"ok": True, "frames": len(frames), "plaintext_bytes": len(stream), "channels": channels}
