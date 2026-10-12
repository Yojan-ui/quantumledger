"""ctypes bindings to engine/build/libaetherpqc — the same liboqs build and the
same canonical order digest the C++ engine verifies against.

ctypes releases the GIL for the duration of each foreign call, so signing can
run on worker threads without stalling the event loop.
"""

from __future__ import annotations

import ctypes as C
import os
import sys
from pathlib import Path

ALG_ML_DSA_65 = 1
ALG_ML_DSA_87 = 2
ALG_ECDSA_P256 = 10

ALG_NAMES = {ALG_ML_DSA_65: "ML-DSA-65", ALG_ML_DSA_87: "ML-DSA-87", ALG_ECDSA_P256: "ECDSA-P256"}

KIND_NEW = 1
KIND_CANCEL = 2


def _find_lib() -> Path:
    env = os.environ.get("AETHER_PQC_LIB")
    if env:
        return Path(env)
    build = Path(__file__).resolve().parents[2] / "engine" / "build"
    name = "libaetherpqc.dylib" if sys.platform == "darwin" else "libaetherpqc.so"
    return build / name


class PqcNative:
    def __init__(self, path: Path | None = None) -> None:
        path = path or _find_lib()
        if not path.exists():
            raise FileNotFoundError(
                f"{path} not found — build the engine first: cmake -S engine -B engine/build && cmake --build engine/build"
            )
        lib = C.CDLL(str(path))
        sz = C.c_size_t
        u8p = C.c_char_p
        lib.aep_liboqs_version.restype = C.c_char_p
        lib.aep_sig_sizes.argtypes = [C.c_int, C.POINTER(sz), C.POINTER(sz), C.POINTER(sz)]
        lib.aep_sig_keypair.argtypes = [C.c_int, u8p, u8p]
        lib.aep_key_fingerprint.argtypes = [u8p, sz, u8p]
        lib.aep_key_fingerprint.restype = None
        lib.aep_order_digest.argtypes = [C.c_int, C.c_uint64, C.c_uint16, C.c_int, C.c_int64, C.c_int64, C.c_uint64, u8p]
        lib.aep_order_digest.restype = None
        lib.aep_sign_order.argtypes = [
            C.c_int, u8p, C.c_uint64, C.c_uint16, C.c_int, C.c_int64, C.c_int64, C.c_uint64, u8p, C.POINTER(sz)
        ]
        lib.aep_sign_cancel.argtypes = [C.c_int, u8p, C.c_uint64, C.c_uint16, C.c_uint64, u8p, C.POINTER(sz)]
        lib.aep_sig_sign_msg.argtypes = [C.c_int, u8p, u8p, sz, u8p, C.POINTER(sz)]
        lib.aep_sig_verify_msg.argtypes = [C.c_int, u8p, u8p, sz, u8p, sz]
        lib.aep_kem_sizes.argtypes = [C.c_int, C.POINTER(sz), C.POINTER(sz), C.POINTER(sz), C.POINTER(sz)]
        lib.aep_kem_keypair.argtypes = [C.c_int, u8p, u8p]
        lib.aep_kem_encaps.argtypes = [C.c_int, u8p, u8p, u8p]
        lib.aep_kem_decaps.argtypes = [C.c_int, u8p, u8p, u8p]
        self._lib = lib
        self.path = path
        self.liboqs_version = lib.aep_liboqs_version().decode()
        self._sig_sizes = {a: self._query_sig(a) for a in (ALG_ML_DSA_65, ALG_ML_DSA_87)}
        self._kem_sizes = {lv: self._query_kem(lv) for lv in (768, 1024)}

    # --- sizes ---------------------------------------------------------------
    def _query_sig(self, alg: int) -> tuple[int, int, int]:
        pk, sk, sg = C.c_size_t(), C.c_size_t(), C.c_size_t()
        if self._lib.aep_sig_sizes(alg, C.byref(pk), C.byref(sk), C.byref(sg)) != 0:
            raise ValueError(f"unsupported sig alg {alg}")
        return pk.value, sk.value, sg.value

    def _query_kem(self, level: int) -> tuple[int, int, int, int]:
        v = [C.c_size_t() for _ in range(4)]
        if self._lib.aep_kem_sizes(level, *(C.byref(x) for x in v)) != 0:
            raise ValueError(f"unsupported KEM level {level}")
        return tuple(x.value for x in v)  # type: ignore[return-value]

    def sig_sizes(self, alg: int) -> tuple[int, int, int]:
        return self._sig_sizes[alg]

    def kem_sizes(self, level: int) -> tuple[int, int, int, int]:
        return self._kem_sizes[level]

    # --- ML-DSA --------------------------------------------------------------
    def sig_keypair(self, alg: int) -> tuple[bytes, bytes]:
        pk_n, sk_n, _ = self._sig_sizes[alg]
        pk, sk = C.create_string_buffer(pk_n), C.create_string_buffer(sk_n)
        if self._lib.aep_sig_keypair(alg, pk, sk) != 0:
            raise RuntimeError("ML-DSA keygen failed")
        return pk.raw, sk.raw

    def key_fingerprint(self, pk: bytes) -> bytes:
        out = C.create_string_buffer(16)
        self._lib.aep_key_fingerprint(pk, len(pk), out)
        return out.raw

    def order_digest(self, kind: int, oid: int, participant: int, side: int, price: int, qty: int, ts_ns: int) -> bytes:
        out = C.create_string_buffer(32)
        self._lib.aep_order_digest(kind, oid, participant, side, price, qty, ts_ns, out)
        return out.raw

    def sign_order(self, alg: int, sk: bytes, oid: int, participant: int, side: int, price: int, qty: int,
                   ts_ns: int) -> bytes:
        buf = C.create_string_buffer(self._sig_sizes[alg][2])
        n = C.c_size_t(len(buf))
        if self._lib.aep_sign_order(alg, sk, oid, participant, side, price, qty, ts_ns, buf, C.byref(n)) != 0:
            raise RuntimeError("ML-DSA sign failed")
        return buf.raw[: n.value]

    def sign_cancel(self, alg: int, sk: bytes, oid: int, participant: int, ts_ns: int) -> bytes:
        buf = C.create_string_buffer(self._sig_sizes[alg][2])
        n = C.c_size_t(len(buf))
        if self._lib.aep_sign_cancel(alg, sk, oid, participant, ts_ns, buf, C.byref(n)) != 0:
            raise RuntimeError("ML-DSA sign failed")
        return buf.raw[: n.value]

    def sign_msg(self, alg: int, sk: bytes, msg: bytes) -> bytes:
        buf = C.create_string_buffer(self._sig_sizes[alg][2])
        n = C.c_size_t(len(buf))
        if self._lib.aep_sig_sign_msg(alg, sk, msg, len(msg), buf, C.byref(n)) != 0:
            raise RuntimeError("ML-DSA sign failed")
        return buf.raw[: n.value]

    def verify_msg(self, alg: int, pk: bytes, msg: bytes, sig: bytes) -> bool:
        return self._lib.aep_sig_verify_msg(alg, pk, msg, len(msg), sig, len(sig)) == 0

    # --- ML-KEM --------------------------------------------------------------
    def kem_keypair(self, level: int) -> tuple[bytes, bytes]:
        pk_n, sk_n, _, _ = self._kem_sizes[level]
        pk, sk = C.create_string_buffer(pk_n), C.create_string_buffer(sk_n)
        if self._lib.aep_kem_keypair(level, pk, sk) != 0:
            raise RuntimeError("ML-KEM keygen failed")
        return pk.raw, sk.raw

    def kem_encaps(self, level: int, pk: bytes) -> tuple[bytes, bytes]:
        _, _, ct_n, ss_n = self._kem_sizes[level]
        ct, ss = C.create_string_buffer(ct_n), C.create_string_buffer(ss_n)
        if self._lib.aep_kem_encaps(level, pk, ct, ss) != 0:
            raise RuntimeError("ML-KEM encaps failed")
        return ct.raw, ss.raw

    def kem_decaps(self, level: int, sk: bytes, ct: bytes) -> bytes:
        ss = C.create_string_buffer(self._kem_sizes[level][3])
        if self._lib.aep_kem_decaps(level, sk, ct, ss) != 0:
            raise RuntimeError("ML-KEM decaps failed")
        return ss.raw
