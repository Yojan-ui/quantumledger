"""Binary ingress frames — mirror of engine/include/aether/Wire.hpp."""

from __future__ import annotations

import struct
from dataclasses import dataclass

REGISTER_KEY = 1
NEW_ORDER = 2
CANCEL = 3
SET_POLICY = 4
RESET = 5

SCALE = 10_000          # fixed-point scale shared with the engine
TICK = 100              # 0.0100

_HDR = struct.Struct("<IB")
_NEW = struct.Struct("<QHBqqQB16sH")     # 54 bytes
_CXL = struct.Struct("<QHQB16sH")        # 37 bytes
_NEW_LAYOUT = struct.Struct("<IBQHBqqQB16sH")
NEW_ORDER_FIXED_WIRE = _NEW_LAYOUT.size  # 59: everything in a NEW_ORDER frame except the signature


def _frame(ftype: int, body: bytes) -> bytes:
    return _HDR.pack(len(body) + 1, ftype) + body


def register_key(participant: int, alg: int, pk: bytes) -> bytes:
    return _frame(REGISTER_KEY, struct.pack("<HBH", participant, alg, len(pk)) + pk)


def new_order(oid: int, participant: int, side: int, price: int, qty: int, ts_ns: int, alg: int, key_fp: bytes,
              sig: bytes) -> bytes:
    return _frame(NEW_ORDER, _NEW.pack(oid, participant, side, price, qty, ts_ns, alg, key_fp, len(sig)) + sig)


def cancel(oid: int, participant: int, ts_ns: int, alg: int, key_fp: bytes, sig: bytes) -> bytes:
    return _frame(CANCEL, _CXL.pack(oid, participant, ts_ns, alg, key_fp, len(sig)) + sig)


def set_policy(min_alg: int) -> bytes:
    return _frame(SET_POLICY, bytes([min_alg]))


def reset() -> bytes:
    return _frame(RESET, b"")


@dataclass(slots=True)
class DecodedOrder:
    oid: int
    participant: int
    side: int
    price: int
    qty: int
    ts_ns: int
    alg: int


def decode_new_order(frame: bytes) -> DecodedOrder | None:
    """What a passive wire tap recovers from a cleartext NEW_ORDER frame."""
    if len(frame) < _NEW_LAYOUT.size or frame[4] != NEW_ORDER:
        return None
    _, _, oid, p, side, price, qty, ts, alg, _, _ = _NEW_LAYOUT.unpack_from(frame)
    return DecodedOrder(oid, p, side, price, qty, ts, alg)


def fmt_px(v: int) -> str:
    sign = "-" if v < 0 else ""
    v = abs(v)
    return f"{sign}{v // SCALE}.{v % SCALE:04d}"[:-2]


def fmt_notional(v: int) -> str:
    """fixed-point notional → '1,234,567.89'"""
    return f"{v // SCALE:,}.{v % SCALE:04d}"[:-2]


def fmt_qty(v: int) -> str:
    return f"{v // SCALE:,}" if v % SCALE == 0 else f"{v / SCALE:,.4f}"
