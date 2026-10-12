"""Cryptographic network agents feeding the C++ dark pool.

Every agent sends real, signed binary orders through the existing EngineClient
link and stamps its identity on the bridge's ORDER_FLOW stream, which the UI
renders as FIX 5.0 with tag 5000=CRYPTO_STATE (scheme / signature bytes).

* NIST_MLDSA_Agent     — the main liquidity flow: institutional blocks, every
                         order ML-DSA signed (3,309 B at NIST L3, 4,627 B at L5).
                         Its frames exceed a 1,500 B MTU, which the network
                         profiler models as multi-packet.
* Paranoid_MLKEM_Agent — trades rarely; before each order it establishes a fresh
                         FIPS 203 ML-KEM session (keygen → encaps → decaps, real
                         liboqs on a worker thread, off the event loop and off the
                         C++ matching thread) and publishes the handshake.
                         It does not reconnect the engine link itself: a new engine
                         session resets the book, so the fresh key is per trade,
                         not per TCP connection.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import random
import time
from typing import Callable

from aether import protocol as P
from aether.pqc_native import ALG_ML_DSA_87, ALG_NAMES, PqcNative
from engine_client import EngineClient, LoadGenerator, MarketState

log = logging.getLogger("aether.agents")


def kem_session(native: PqcNative, level: int) -> dict:
    """One real ML-KEM session establishment. Only a fingerprint of the shared secret leaves this function."""
    t0 = time.perf_counter_ns(); pk, sk = native.kem_keypair(level)
    t1 = time.perf_counter_ns(); ct, ss = native.kem_encaps(level, pk)
    t2 = time.perf_counter_ns(); ss2 = native.kem_decaps(level, sk, ct)
    t3 = time.perf_counter_ns()
    return {"level": level, "pk_bytes": len(pk), "ct_bytes": len(ct), "ss_bytes": len(ss),
            "keygen_ns": t1 - t0, "encaps_ns": t2 - t1, "decaps_ns": t3 - t2, "match": ss == ss2,
            "pk_head": pk[:24].hex(), "ct_head": ct[:24].hex(), "k_fp": hashlib.sha3_256(ss).hexdigest()[:16]}


class NIST_MLDSA_Agent(LoadGenerator):
    """Mean-reverting institutional flow in blocks, every message ML-DSA signed."""

    BLOCK_MULT = 4

    def __init__(self, client: EngineClient, state: MarketState) -> None:
        super().__init__(client, state)
        self.agent = "NIST_MLDSA"
        self.qty_mult = self.BLOCK_MULT


class Paranoid_MLKEM_Agent:
    """Re-keys with ML-KEM before every order; publishes each handshake."""

    MIN_GAP_S, MAX_GAP_S = 4.0, 8.0
    DESK = 16

    def __init__(self, client: EngineClient, state: MarketState, publish: Callable[[dict], None]) -> None:
        self.client = client
        self.state = state
        self.publish = publish
        self.running = True
        self.sessions = 0
        self._rng = random.Random(203)

    async def run(self) -> None:
        while True:
            await asyncio.sleep(self._rng.uniform(self.MIN_GAP_S, self.MAX_GAP_S))
            if not (self.running and self.client.connected and self.state.keys_registered and self.state.l2):
                continue
            try:
                await self._trade()
            except ConnectionError:
                pass
            except Exception:                       # never take the bridge down
                log.exception("ML-KEM agent step failed")

    async def _trade(self) -> None:
        c = self.client
        level = 1024 if c.sign_alg == ALG_ML_DSA_87 else 768
        hs = await asyncio.to_thread(kem_session, c.native, level)
        self.sessions += 1
        hs.update({"type": "KEM_HANDSHAKE", "agent": "PARANOID_MLKEM", "session": self.sessions})
        self.publish(hs)

        # one passive order one tick inside the touch on a random side, signed under the current policy
        l2 = self.state.l2
        side = self._rng.randrange(2)
        book = l2["bids"] if side == 0 else l2["asks"]
        if not book:
            return
        px = book[0][0] + (P.TICK if side == 0 else -P.TICK)
        qty = self._rng.randint(5, 40) * P.SCALE
        desk = c.desk_by_pid[self.DESK]
        oid, wire, _ = await c.send_signed_order(desk, side, px, qty)
        alg = ALG_NAMES[c.sign_alg]
        self.state.pending_orders.append({"k": "N", "id": oid, "p": desk.pid, "side": side, "px": px, "qty": qty,
                                          "ts": time.time_ns(), "alg": alg, "wire": wire, "agent": "PARANOID_MLKEM"})
