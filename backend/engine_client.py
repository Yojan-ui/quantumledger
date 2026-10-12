"""Async bridge to the C++ engine (127.0.0.1:9001).

* EngineClient   — owns the TCP session: provisions desk keys, writes signed
                   binary frames, reads NDJSON events into MarketState.
* LoadGenerator  — institutional order flow (500–2,000 msg/s), every message
                   ML-DSA signed via libaetherpqc on a worker thread.
* Adversary      — passive wire tap ("harvest now, decrypt later") plus active
                   injection: classical-signed, tampered, forged, spoofed,
                   replayed, stale and downgraded orders.

Every number surfaced to the UI originates in the engine's telemetry or is
measured here; nothing is synthesised for display.
"""

from __future__ import annotations

import asyncio
import itertools
import logging
import os
import random
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Callable

import orjson
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec

from aether import protocol as P
from aether.pqc_native import (ALG_ECDSA_P256, ALG_ML_DSA_65, ALG_ML_DSA_87, ALG_NAMES, KIND_NEW, PqcNative)

log = logging.getLogger("aether.engine")

ENGINE_HOST = os.environ.get("AETHER_ENGINE_HOST", "127.0.0.1")
ENGINE_PORT = int(os.environ.get("AETHER_ENGINE_PORT", "9001"))
N_DESKS = 16
ADVERSARY_PID = 666          # never provisioned


# ---------------------------------------------------------------------------
# Desks (institutional participants) and their PQC identities

@dataclass(slots=True)
class DeskKey:
    pk: bytes
    sk: bytes
    fp: bytes


@dataclass(slots=True)
class Desk:
    pid: int
    label: str
    keys: dict[int, DeskKey]


def provision_desks(native: PqcNative, n: int = N_DESKS) -> list[Desk]:
    desks = []
    for i in range(1, n + 1):
        keys = {}
        for alg in (ALG_ML_DSA_65, ALG_ML_DSA_87):
            pk, sk = native.sig_keypair(alg)
            keys[alg] = DeskKey(pk, sk, native.key_fingerprint(pk))
        desks.append(Desk(pid=i, label=f"DESK-{i:02d}", keys=keys))
    return desks


# ---------------------------------------------------------------------------
# Market state fed by engine events

@dataclass(slots=True)
class OpenOrder:
    pid: int
    side: int
    price: int
    rem: int


@dataclass
class MarketState:
    hello: dict | None = None
    bench: dict | None = None
    l2: dict | None = None
    l2_version: int = 0
    tel_in: dict | None = None
    tel_match: dict | None = None
    tel_version: int = 0
    policy: str = "ML-DSA-65"
    last_hb: dict | None = None
    last_hb_mono: float = 0.0
    connected: bool = False
    keys_registered: int = 0
    last_trade_px: int | None = None

    trades: deque = field(default_factory=lambda: deque(maxlen=300))
    pending_trades: list = field(default_factory=list)
    attack_log: deque = field(default_factory=lambda: deque(maxlen=400))
    pending_log: list = field(default_factory=list)
    pending_orders: list = field(default_factory=list)   # inbound order flow, for the FIX tape
    reject_counts: dict[str, int] = field(default_factory=dict)
    breaches: int = 0

    open_orders: dict[int, OpenOrder] = field(default_factory=dict)
    sent: dict[int, tuple[int, int, int, int]] = field(default_factory=dict)   # id -> (pid, side, px, qty)
    attacks_inflight: dict[int, dict] = field(default_factory=dict)            # id -> attack meta
    waiters: dict[int, dict] = field(default_factory=dict)                     # id -> {fut, fills}

    def log_line(self, level: str, tag: str, msg: str, **extra: Any) -> None:
        entry = {"ts": time.time_ns(), "level": level, "tag": tag, "msg": msg, **extra}
        self.attack_log.append(entry)
        self.pending_log.append(entry)

    def reset_book_state(self) -> None:
        self.open_orders.clear()
        self.sent.clear()
        self.attacks_inflight.clear()
        self.l2 = None

    # -- event dispatch -------------------------------------------------------
    def on_event(self, e: dict) -> None:
        t = e.get("t")
        if t == "ACK":
            oid = e["id"]
            meta = self.sent.pop(oid, None)
            if e["rem"] > 0 and meta:
                self.open_orders[oid] = OpenOrder(meta[0], meta[1], meta[2], e["rem"])
            atk = self.attacks_inflight.pop(oid, None)
            if atk is not None:
                # An adversarial message got through the gate. This must never happen.
                self.breaches += 1
                self.log_line("crit", "BREACH", f"{atk['kind']} order #{oid} ACCEPTED by engine", attack=atk["kind"])
            self._resolve(oid, e)
        elif t == "TRADE":
            self.last_trade_px = e["px"]
            self.trades.append(e)
            self.pending_trades.append(e)
            mk = self.open_orders.get(e["maker"])
            if mk is not None:
                if e["mrem"] <= 0:
                    del self.open_orders[e["maker"]]
                else:
                    mk.rem = e["mrem"]
            w = self.waiters.get(e["taker"])
            if w is not None:
                w["fills"].append(e)
        elif t == "CXL":
            self.open_orders.pop(e["id"], None)
        elif t == "REJ":
            self._on_reject(e)
        elif t == "L2":
            self.l2 = e
            self.l2_version += 1
        elif t == "TEL_IN":
            self.tel_in = e
            self.policy = e.get("policy", self.policy)
            self.tel_version += 1
        elif t == "TEL_MATCH":
            self.tel_match = e
            self.tel_version += 1
        elif t == "HB":
            self.last_hb = e
            self.last_hb_mono = time.monotonic()
        elif t == "KEY":
            if e.get("ok"):
                self.keys_registered += 1
        elif t == "POLICY":
            self.policy = e["min_alg"]
            self.log_line("info", "POLICY", f"engine minimum signature level set to {e['min_alg']}")
        elif t == "HELLO":
            self.hello = e
        elif t == "BENCH":
            self.bench = e
            self.tel_version += 1
        elif t == "RESET":
            self.reset_book_state()

    def _on_reject(self, e: dict) -> None:
        oid, why = e["id"], e["why"]
        self.reject_counts[why] = self.reject_counts.get(why, 0) + 1
        self.sent.pop(oid, None)
        atk = self.attacks_inflight.pop(oid, None)
        if e["kind"] == "CANCEL" and why == "UNKNOWN_ORDER":
            # benign race: order filled before our cancel arrived
            self.open_orders.pop(oid, None)
            self._resolve(oid, e)
            return
        if atk is not None:
            gate_us = e["gate_ns"] / 1000
            verify = f" verify={e['verify_ns'] / 1000:.1f}µs" if e["verify_ns"] else ""
            self.log_line(
                "drop", why,
                f"{atk['kind']:<10} p={e['p']:<4} #{oid} {e['alg']:<10} {e['wire']:>5}B gate={gate_us:.1f}µs{verify} → DROPPED",
                attack=atk["kind"], wire=e["wire"],
            )
        else:
            self.log_line("warn", why, f"order #{oid} p={e['p']} {e['alg']} rejected ({why})")
        self._resolve(oid, e)

    def _resolve(self, oid: int, e: dict) -> None:
        w = self.waiters.pop(oid, None)
        if w is not None and not w["fut"].done():
            w["fut"].set_result({"event": e, "fills": w["fills"]})


# ---------------------------------------------------------------------------

class EngineClient:
    def __init__(self, native: PqcNative, state: MarketState, desks: list[Desk]) -> None:
        self.native = native
        self.state = state
        self.desks = desks
        self.desk_by_pid = {d.pid: d for d in desks}
        self.sign_alg = ALG_ML_DSA_65
        self._writer: asyncio.StreamWriter | None = None
        self.send_lock = asyncio.Lock()     # id assignment → sign → write stays ordered
        self._ids = itertools.count(1)
        self.on_connect: list[Callable[[], None]] = []
        self.bytes_out = 0
        self.frames_out = 0
        self.tap: Callable[[bytes, int], None] | None = None   # passive wire observer

    def next_id(self) -> int:
        return next(self._ids)

    @property
    def connected(self) -> bool:
        return self._writer is not None and not self._writer.is_closing()

    async def run(self) -> None:
        while True:
            try:
                reader, writer = await asyncio.open_connection(ENGINE_HOST, ENGINE_PORT, limit=1 << 22)
            except OSError:
                self.state.connected = False
                await asyncio.sleep(1.0)
                continue
            log.info("connected to engine %s:%d", ENGINE_HOST, ENGINE_PORT)
            self._writer = writer
            self.state.connected = True
            self.state.keys_registered = 0
            self.state.reset_book_state()
            self._ids = itertools.count(1)
            # fresh session: clean book + replay state, then provision every desk
            frames = [P.reset()]
            for d in self.desks:
                for alg, k in d.keys.items():
                    frames.append(P.register_key(d.pid, alg, k.pk))
            frames.append(P.set_policy(self.sign_alg))
            self.write(b"".join(frames))
            self.state.log_line("info", "PROVISION",
                                f"{len(self.desks)} desks × 2 ML-DSA keys registered over trusted channel")
            for cb in self.on_connect:
                cb()
            try:
                while True:
                    line = await reader.readline()
                    if not line:
                        break
                    self.state.on_event(orjson.loads(line))
            except (ConnectionError, asyncio.IncompleteReadError, ValueError) as exc:
                log.warning("engine stream error: %s", exc)
            finally:
                self._writer = None
                self.state.connected = False
                writer.close()
                self.state.log_line("warn", "LINK", "engine connection lost — reconnecting")
            await asyncio.sleep(0.5)

    def write(self, data: bytes) -> None:
        if self._writer is None:
            raise ConnectionError("engine not connected")
        self._writer.write(data)
        self.bytes_out += len(data)

    async def drain(self) -> None:
        if self._writer is not None:
            await self._writer.drain()

    async def set_level(self, alg: int) -> None:
        async with self.send_lock:
            self.sign_alg = alg
            if self.connected:
                self.write(P.set_policy(alg))
                await self.drain()

    # -- signing helpers (run on worker threads) -----------------------------
    def build_order(self, desk: Desk, oid: int, side: int, px: int, qty: int, alg: int | None = None) -> bytes:
        alg = alg or self.sign_alg
        k = desk.keys[alg]
        ts = time.time_ns()
        sig = self.native.sign_order(alg, k.sk, oid, desk.pid, side, px, qty, ts)
        return P.new_order(oid, desk.pid, side, px, qty, ts, alg, k.fp, sig)

    def build_cancel(self, desk: Desk, oid: int) -> bytes:
        k = desk.keys[self.sign_alg]
        ts = time.time_ns()
        sig = self.native.sign_cancel(self.sign_alg, k.sk, oid, desk.pid, ts)
        return P.cancel(oid, desk.pid, ts, self.sign_alg, k.fp, sig)

    async def send_signed_order(self, desk: Desk, side: int, px: int, qty: int,
                                waiter: asyncio.Future | None = None) -> tuple[int, int, float]:
        """Manual injection path. Returns (order id, wire bytes, sign µs)."""
        async with self.send_lock:
            oid = self.next_id()
            t0 = time.perf_counter_ns()
            frame = await asyncio.to_thread(self.build_order, desk, oid, side, px, qty)
            sign_us = (time.perf_counter_ns() - t0) / 1000
            self.state.sent[oid] = (desk.pid, side, px, qty)
            if waiter is not None:
                self.state.waiters[oid] = {"fut": waiter, "fills": []}
            self.write(frame)
            if self.tap:
                self.tap(frame, oid)
            await self.drain()
            return oid, len(frame), sign_us


# ---------------------------------------------------------------------------

class LoadGenerator:
    """Mean-reverting institutional flow around a drifting fair value."""

    TICK_S = 0.02

    def __init__(self, client: EngineClient, state: MarketState) -> None:
        self.client = client
        self.state = state
        self.running = True
        self.rate = 800                # target msgs/s
        self.fair = 250 * P.SCALE      # fixed-point fair value
        self.sent_window: deque[tuple[float, int]] = deque()
        self.sign_ns_total = 0
        self.sign_count = 0
        self._carry = 0.0
        self._rng = random.Random(7)
        self.agent = "MARKET"          # identity stamped on ORDER_FLOW entries (FIX tag 5000)
        self.qty_mult = 1              # block-size multiplier for subclassed agents

    @property
    def achieved_rate(self) -> float:
        now = time.monotonic()
        while self.sent_window and now - self.sent_window[0][0] > 2.0:
            self.sent_window.popleft()
        return sum(n for _, n in self.sent_window) / 2.0

    def _evolve_fair(self) -> None:
        r = self._rng
        # random walk with mild pull toward the last print
        drift = 0.0
        if self.state.last_trade_px is not None:
            drift = 0.02 * (self.state.last_trade_px - self.fair)
        self.fair += int(drift + r.gauss(0, 0.6) * P.TICK)
        self.fair = max(50 * P.SCALE, min(600 * P.SCALE, self.fair))

    def _plan(self, n: int) -> list[tuple]:
        r = self._rng
        st = self.state
        plan: list[tuple] = []
        open_ids = list(st.open_orders.keys()) if st.open_orders else []
        fair_tick = self.fair // P.TICK
        bids = st.l2["bids"] if st.l2 else []
        asks = st.l2["asks"] if st.l2 else []
        best_bid = bids[0][0] // P.TICK if bids else fair_tick - 1
        best_ask = asks[0][0] // P.TICK if asks else fair_tick + 1
        cancel_bias = 0.30 + min(0.5, len(open_ids) / 6000)
        for _ in range(n):
            if open_ids and r.random() < cancel_bias:
                oid = open_ids.pop(r.randrange(len(open_ids)))
                o = st.open_orders.pop(oid, None)
                if o is not None:
                    plan.append(("C", self.client.desk_by_pid[o.pid], oid))
                continue
            desk = self.client.desks[r.randrange(len(self.client.desks))]
            side = 0 if r.random() < 0.5 else 1
            if r.random() < 0.14:
                # marketable: sweep through the far touch by 0–3 ticks
                t = best_ask + r.randint(0, 3) if side == 0 else best_bid - r.randint(0, 3)
            else:
                depth = int(r.expovariate(0.18)) + 1
                t = fair_tick - depth if side == 0 else fair_tick + depth
            qty = max(1, int(r.lognormvariate(3.0, 0.9))) * self.qty_mult * P.SCALE
            plan.append(("N", desk, side, t * P.TICK, qty))
        return plan

    def _sign(self, plan: list[tuple], ids: list[int]) -> tuple[list[bytes], int]:
        t0 = time.perf_counter_ns()
        out = []
        for item, oid in zip(plan, ids):
            if item[0] == "N":
                _, desk, side, px, qty = item
                out.append(self.client.build_order(desk, oid, side, px, qty))
            else:
                _, desk, cid = item
                out.append(self.client.build_cancel(desk, cid))
        return out, time.perf_counter_ns() - t0

    async def run(self) -> None:
        while True:
            t_start = time.monotonic()
            if self.running and self.client.connected and self.state.keys_registered > 0:
                self._evolve_fair()
                self._carry += self.rate * self.TICK_S
                n = int(self._carry)
                self._carry -= n
                if n:
                    try:
                        await self._send_batch(n)
                    except ConnectionError:
                        pass
            await asyncio.sleep(max(0.0, self.TICK_S - (time.monotonic() - t_start)))

    async def _send_batch(self, n: int) -> None:
        plan = self._plan(n)
        if not plan:
            return
        async with self.client.send_lock:
            ids = [self.client.next_id() if p[0] == "N" else 0 for p in plan]
            # split across two threads: ML-DSA signing dominates the cost
            half = len(plan) // 2
            if half >= 4:
                (f1, ns1), (f2, ns2) = await asyncio.gather(
                    asyncio.to_thread(self._sign, plan[:half], ids[:half]),
                    asyncio.to_thread(self._sign, plan[half:], ids[half:]),
                )
                frames, ns = f1 + f2, ns1 + ns2
            else:
                frames, ns = await asyncio.to_thread(self._sign, plan, ids)
            self.sign_ns_total += ns
            self.sign_count += len(frames)
            alg = ALG_NAMES[self.client.sign_alg]
            now = time.time_ns()
            flow = self.state.pending_orders
            for item, oid, fr in zip(plan, ids, frames):
                if item[0] == "N":
                    self.state.sent[oid] = (item[1].pid, item[2], item[3], item[4])
                    if self.client.tap:
                        self.client.tap(fr, oid)
                    flow.append({"k": "N", "id": oid, "p": item[1].pid, "side": item[2], "px": item[3], "qty": item[4],
                                 "ts": now, "alg": alg, "wire": len(fr), "agent": self.agent})
                else:
                    flow.append({"k": "C", "id": item[2], "p": item[1].pid, "ts": now, "alg": alg, "wire": len(fr),
                                 "agent": self.agent})
            if len(flow) > 4000:
                del flow[:-4000]
            self.client.write(b"".join(frames))
            await self.client.drain()
        self.sent_window.append((time.monotonic(), len(frames)))


# ---------------------------------------------------------------------------

THREAT_RATES = {0: 0.0, 1: 4.0, 2: 20.0, 3: 80.0}
THREAT_NAMES = {0: "DORMANT", 1: "PROBE", 2: "SUSTAINED", 3: "SIEGE"}

ATTACK_KINDS = ("CLASSICAL", "TAMPER", "FORGE", "SPOOF", "REPLAY", "STALE", "DOWNGRADE", "ROGUE")


class Adversary:
    """Active injector + passive harvesting tap on the order-entry link."""

    def __init__(self, client: EngineClient, state: MarketState) -> None:
        self.client = client
        self.state = state
        self.level = 0
        self.native = client.native
        self.ecdsa_key = ec.generate_private_key(ec.SECP256R1())
        pk, sk = self.native.sig_keypair(ALG_ML_DSA_65)
        self.rogue = (pk, sk, self.native.key_fingerprint(pk))   # attacker's own ML-DSA identity
        self.harvest: deque[tuple[int, bytes]] = deque(maxlen=512)
        self.harvested_bytes = 0
        self.harvested_frames = 0
        self.sent_by_kind: dict[str, int] = {k: 0 for k in ATTACK_KINDS}
        self._rng = random.Random(1337)
        client.tap = self._on_wire

    # passive tap: every legitimate frame crossing the link is recorded
    def _on_wire(self, frame: bytes, oid: int) -> None:
        self.harvest.append((oid, frame))
        self.harvested_bytes += len(frame)
        self.harvested_frames += 1

    def recent_frames(self, n: int) -> list[bytes]:
        return [f for _, f in list(self.harvest)[-n:]]

    def _mid(self) -> int:
        st = self.state
        if st.l2 and st.l2["bids"] and st.l2["asks"]:
            return (st.l2["bids"][0][0] + st.l2["asks"][0][0]) // 2 // P.TICK * P.TICK
        return 250 * P.SCALE

    def craft(self, kind: str) -> tuple[int, bytes, int] | None:
        """Build one adversarial frame. Returns (order id, frame, claimed pid)."""
        r = self._rng
        c = self.client
        desk = c.desks[r.randrange(len(c.desks))]
        side = r.randrange(2)
        px = self._mid() + (r.randint(-5, 5) * P.TICK)
        qty = r.randint(50, 500) * P.SCALE      # outsized clips — what a spoofer wants filled
        ts = time.time_ns()
        alg = c.sign_alg
        k = desk.keys[alg]

        if kind == "CLASSICAL":
            # Valid ECDSA-P256 signature over the exact canonical digest. Cryptographically
            # sound today; forgeable by a CRQC tomorrow. Policy refuses the algorithm outright.
            oid = c.next_id()
            digest = self.native.order_digest(KIND_NEW, oid, desk.pid, side, px, qty, ts)
            sig = self.ecdsa_key.sign(digest, ec.ECDSA(hashes.SHA256()))
            return oid, P.new_order(oid, desk.pid, side, px, qty, ts, ALG_ECDSA_P256, k.fp, sig), desk.pid
        if kind == "TAMPER":
            # MITM: legitimate signature, price rewritten in flight
            oid = c.next_id()
            sig = self.native.sign_order(alg, k.sk, oid, desk.pid, side, px, qty, ts)
            evil_px = px + (-20 if side == 0 else 20) * P.TICK
            return oid, P.new_order(oid, desk.pid, side, evil_px, qty, ts, alg, k.fp, sig), desk.pid
        if kind == "FORGE":
            oid = c.next_id()
            sig = os.urandom(self.native.sig_sizes(alg)[2])
            return oid, P.new_order(oid, desk.pid, side, px, qty, ts, alg, k.fp, sig), desk.pid
        if kind == "SPOOF":
            # attacker's own valid ML-DSA key, claiming to be a provisioned desk
            oid = c.next_id()
            rpk, rsk, rfp = self.rogue
            sig = self.native.sign_order(ALG_ML_DSA_65, rsk, oid, desk.pid, side, px, qty, ts)
            return oid, P.new_order(oid, desk.pid, side, px, qty, ts, ALG_ML_DSA_65, rfp, sig), desk.pid
        if kind == "REPLAY":
            # Only replay frames the engine has already resolved: the replay shares the
            # original's order id, so an in-flight original's ACK would be misattributed.
            settled = [(o, f) for o, f in self.harvest if o not in self.state.sent]
            if not settled:
                return None
            oid, frame = settled[r.randrange(len(settled))]
            pid = int.from_bytes(frame[13:15], "little")
            return oid, frame, pid
        if kind == "STALE":
            oid = c.next_id()
            old = ts - 30_000_000_000
            sig = self.native.sign_order(alg, k.sk, oid, desk.pid, side, px, qty, old)
            return oid, P.new_order(oid, desk.pid, side, px, qty, old, alg, k.fp, sig), desk.pid
        if kind == "DOWNGRADE":
            if alg != ALG_ML_DSA_87:
                return None     # only meaningful while policy demands NIST category 5
            oid = c.next_id()
            k65 = desk.keys[ALG_ML_DSA_65]
            sig = self.native.sign_order(ALG_ML_DSA_65, k65.sk, oid, desk.pid, side, px, qty, ts)
            return oid, P.new_order(oid, desk.pid, side, px, qty, ts, ALG_ML_DSA_65, k65.fp, sig), desk.pid
        if kind == "ROGUE":
            oid = c.next_id()
            rpk, rsk, rfp = self.rogue
            sig = self.native.sign_order(ALG_ML_DSA_65, rsk, oid, ADVERSARY_PID, side, px, qty, ts)
            return oid, P.new_order(oid, ADVERSARY_PID, side, px, qty, ts, ALG_ML_DSA_65, rfp, sig), ADVERSARY_PID
        raise ValueError(kind)

    async def inject(self, kind: str) -> dict:
        """Send a single attack and wait for the engine's verdict."""
        c = self.client
        loop = asyncio.get_running_loop()
        async with c.send_lock:
            crafted = await asyncio.to_thread(self.craft, kind)
            if crafted is None:
                return {"kind": kind, "skipped": True,
                        "reason": "needs harvested traffic" if kind == "REPLAY" else "policy already at ML-DSA-65"}
            oid, frame, pid = crafted
            fut = loop.create_future()
            self.state.attacks_inflight[oid] = {"kind": kind, "pid": pid}
            self.state.waiters[oid] = {"fut": fut, "fills": []}
            c.write(frame)
            await c.drain()
        self.sent_by_kind[kind] += 1
        try:
            res = await asyncio.wait_for(fut, 2.0)
        except asyncio.TimeoutError:
            self.state.waiters.pop(oid, None)
            return {"kind": kind, "id": oid, "verdict": "TIMEOUT"}
        ev = res["event"]
        return {"kind": kind, "id": oid, "wire": len(frame), "verdict": ev.get("why", ev["t"]), "engine": ev}

    async def run(self) -> None:
        r = self._rng
        while True:
            rate = THREAT_RATES.get(self.level, 0.0)
            if rate <= 0 or not self.client.connected or self.state.keys_registered == 0:
                await asyncio.sleep(0.2)
                continue
            await asyncio.sleep(r.expovariate(rate))
            kind = ATTACK_KINDS[r.randrange(len(ATTACK_KINDS))]
            try:
                asyncio.get_running_loop().create_task(self.inject(kind))
            except ConnectionError:
                pass


def threat_name(level: int) -> str:
    return THREAT_NAMES.get(level, "?")
