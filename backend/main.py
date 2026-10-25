"""AetherPool bridge — FastAPI WebSocket hub + REST control plane.

    uvicorn main:app --host 127.0.0.1 --port 8000

WebSocket /ws streams:
    SNAPSHOT          full state on connect
    L2_DEPTH          top-25 levels per side with cumulative size + L3 queue at the touch (10 Hz)
    EXECUTION_TICK    batched fills with PQC verify latency and wire size (≤20 Hz)
    CRYPTO_TELEMETRY  live engine histograms + classical vs ML-DSA/ML-KEM comparison (2 Hz)
    ATTACK_LOG        gate rejections / provisioning / harvest-sim lines
    ORDER_FLOW        sampled inbound signed orders / cancels as sent to the engine (≤20 Hz)
    ENGINE_STATUS     heartbeat, link, controls, generator + adversary counters (4 Hz)
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from typing import Literal

import orjson
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel, Field

import harvest
from local_only import APP_ORIGINS, LocalOnly
import quantumledger
from agents.market_simulator import NIST_MLDSA_Agent, Paranoid_MLKEM_Agent, kem_session
from aether import protocol as P
from aether.pqc_native import ALG_ML_DSA_65, ALG_ML_DSA_87, ALG_NAMES, PqcNative
from engine_client import (ATTACK_KINDS, Adversary, EngineClient, MarketState, provision_desks,
                           threat_name)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("aether.hub")


class Hub:
    def __init__(self) -> None:
        self.native = PqcNative()
        self.state = MarketState()
        self.desks = provision_desks(self.native)
        self.client = EngineClient(self.native, self.state, self.desks)
        self.gen = NIST_MLDSA_Agent(self.client, self.state)
        self.kem_agent = Paranoid_MLKEM_Agent(self.client, self.state, self.broadcast)
        self.ql = quantumledger.QuantumLedger(self.native)
        self.adv = Adversary(self.client, self.state)
        self.clients: set[asyncio.Queue] = set()
        self.tasks: list[asyncio.Task] = []
        log.info("libaetherpqc loaded from %s (liboqs %s)", self.native.path, self.native.liboqs_version)

    @property
    def nist_level(self) -> int:
        return 5 if self.client.sign_alg == ALG_ML_DSA_87 else 3

    # -- payload builders ---------------------------------------------------
    def l2_payload(self) -> dict | None:
        l2 = self.state.l2
        if not l2:
            return None

        def side(rows):
            cum, out = 0, []
            for px, qty, n in rows:
                cum += qty
                out.append({"px": px, "qty": qty, "n": n, "cum": cum})
            return out

        bids, asks = side(l2["bids"]), side(l2["asks"])
        mid = spread = None
        if bids and asks:
            mid = (bids[0]["px"] + asks[0]["px"]) // 2
            spread = asks[0]["px"] - bids[0]["px"]
        return {"type": "L2_DEPTH", "seq": l2["seq"], "ts": l2["ts"], "scale": P.SCALE, "tick": P.TICK,
                "bids": bids, "asks": asks, "l3b": l2["l3b"], "l3a": l2["l3a"], "mid": mid, "spread": spread}

    def comparison(self) -> dict | None:
        b, h = self.state.bench, self.state.hello
        if not b or not h:
            return None
        sig = {r["name"]: r for r in b["sig"]}
        kem = {r["name"]: r for r in b["kem"]}
        fixed = h["order_fixed_bytes"]
        ghz = h.get("est_core_ghz") or 0

        rows = []
        for name in ("ECDSA-P256", "RSA-2048", "ML-DSA-65", "ML-DSA-87"):
            r = sig.get(name)
            if not r or not r["available"]:
                continue
            rows.append({
                "name": name, "backend": r["backend"], "pqc": name.startswith("ML-"),
                "sign_ns": r["sign_ns"], "verify_ns": r["verify_ns"], "verify_p99_ns": r["verify_p99_ns"],
                "keygen_ns": r["keygen_ns"], "pk_bytes": r["pk_bytes"], "sk_bytes": r["sk_bytes"],
                "sig_bytes": r["sig_bytes"], "order_wire_bytes": fixed + r["sig_bytes"],
                "verify_per_core_s": int(1e9 / r["verify_ns"]) if r["verify_ns"] else None,
                "verify_est_cycles": int(r["verify_ns"] * ghz) if ghz else None,
            })

        def hs(k, s):
            if not (k in kem and s in sig and kem[k]["available"] and sig[s]["available"]):
                return None
            K, S = kem[k], sig[s]
            return {"kem": k, "sig": s, "kem_pk": K["pk_bytes"], "kem_ct": K["ct_bytes"], "sig_bytes": S["sig_bytes"],
                    "sig_pk": S["pk_bytes"],
                    "total": K["pk_bytes"] + K["ct_bytes"] + S["sig_bytes"] + S["pk_bytes"],
                    "kem_ns": K["encaps_ns"] + K["decaps_ns"], "sig_verify_ns": S["verify_ns"]}

        handshakes = [x for x in (hs("ECDH-P256", "RSA-2048"), hs("ECDH-P256", "ECDSA-P256"),
                                  hs("ML-KEM-768", "ML-DSA-65"), hs("ML-KEM-1024", "ML-DSA-87")) if x]
        return {"sig": rows, "kem": b["kem"], "handshakes": handshakes, "order_fixed_bytes": fixed,
                "est_core_ghz": ghz, "cpu": h.get("cpu"), "counter": h.get("counter"),
                "counter_hz": h.get("counter_hz"), "liboqs": h.get("liboqs")}

    def telemetry_payload(self) -> dict:
        gen = self.gen
        return {"type": "CRYPTO_TELEMETRY", "tel_in": self.state.tel_in, "tel_match": self.state.tel_match,
                "comparison": self.comparison(),
                "client_sign_us": round(gen.sign_ns_total / gen.sign_count / 1000, 1) if gen.sign_count else None}

    def status_payload(self) -> dict:
        st = self.state
        hb_age = (time.monotonic() - st.last_hb_mono) * 1000 if st.last_hb_mono else None
        return {
            "type": "ENGINE_STATUS", "connected": st.connected,
            "hb_age_ms": round(hb_age) if hb_age is not None else None,
            "hb_seq": st.last_hb["seq"] if st.last_hb else None,
            "uptime_ns": st.last_hb["uptime_ns"] if st.last_hb else None,
            "evt_drops": st.last_hb["evt_drops"] if st.last_hb else None,
            "policy": st.policy, "keys": st.keys_registered, "desks": len(self.desks),
            "controls": {"playback": self.gen.running, "rate": self.gen.rate, "threat_level": self.adv.level,
                         "threat_name": threat_name(self.adv.level), "nist_level": self.nist_level},
            "generator": {"achieved_rate": round(self.gen.achieved_rate), "frames_out": self.client.bytes_out},
            "adversary": {"harvested_bytes": self.adv.harvested_bytes, "harvested_frames": self.adv.harvested_frames,
                          "sent_by_kind": self.adv.sent_by_kind},
            "rejects": st.reject_counts, "breaches": st.breaches, "open_orders": len(st.open_orders),
            "agents": {"NIST_MLDSA": round(self.gen.achieved_rate), "PARANOID_MLKEM": self.kem_agent.sessions},
        }

    def snapshot(self) -> dict:
        return {"type": "SNAPSHOT", "hello": self.state.hello, "status": self.status_payload(),
                "telemetry": self.telemetry_payload(), "l2": self.l2_payload(),
                "trades": list(self.state.trades)[-120:], "log": list(self.state.attack_log)[-200:]}

    # -- fan-out ------------------------------------------------------------
    def broadcast(self, msg: dict) -> None:
        data = orjson.dumps(msg)
        for q in self.clients:
            if q.full():          # slow consumer: drop its oldest frame rather than stall everyone
                with contextlib.suppress(asyncio.QueueEmpty):
                    q.get_nowait()
            q.put_nowait(data)

    async def pump(self) -> None:
        last_l2 = last_tel = -1
        tick = 0
        while True:
            await asyncio.sleep(0.05)
            tick += 1
            st = self.state
            if st.pending_trades:
                trades, st.pending_trades = st.pending_trades, []
                self.broadcast({"type": "EXECUTION_TICK", "trades": trades[-400:]})
            if st.pending_orders:
                orders, st.pending_orders = st.pending_orders, []
                self.broadcast({"type": "ORDER_FLOW", "orders": orders[-60:], "n": len(orders)})
            if st.pending_log:
                lines, st.pending_log = st.pending_log, []
                self.broadcast({"type": "ATTACK_LOG", "lines": lines[-200:]})
            if st.l2_version != last_l2 and st.l2:
                last_l2 = st.l2_version
                self.broadcast(self.l2_payload())
            if tick % 10 == 0 and st.tel_version != last_tel:
                last_tel = st.tel_version
                self.broadcast(self.telemetry_payload())
            if tick % 5 == 0:
                self.broadcast(self.status_payload())

    async def start(self) -> None:
        self.tasks = [asyncio.create_task(c) for c in
                      (self.client.run(), self.gen.run(), self.kem_agent.run(), self.adv.run(), self.pump())]

    async def stop(self) -> None:
        for t in self.tasks:
            t.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)


hub: Hub | None = None


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI):
    global hub
    hub = Hub()
    await hub.start()
    yield
    await hub.stop()


app = FastAPI(title="AetherPool Bridge", lifespan=lifespan, default_response_class=ORJSONResponse)
app.add_middleware(CORSMiddleware, allow_origins=sorted(APP_ORIGINS),
                   allow_methods=["*"], allow_headers=["*"])
# Outermost: only this machine's own UI reaches any route or the WebSocket (see local_only.py).
app.add_middleware(LocalOnly)


def H() -> Hub:
    assert hub is not None
    return hub


def require_engine() -> Hub:
    h = H()
    if not h.client.connected or h.state.keys_registered == 0:
        raise HTTPException(503, "engine not connected")
    return h


# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def ws(sock: WebSocket) -> None:
    await sock.accept()
    h = H()
    q: asyncio.Queue = asyncio.Queue(maxsize=256)
    await sock.send_text(orjson.dumps(h.snapshot()).decode())
    h.clients.add(q)

    async def sender():
        while True:
            data = await q.get()
            await sock.send_text(data.decode())

    task = asyncio.create_task(sender())
    try:
        while True:
            await sock.receive_text()        # client → server is REST only; this just detects close
    except WebSocketDisconnect:
        pass
    finally:
        h.clients.discard(q)
        task.cancel()


class InjectReq(BaseModel):
    mode: Literal["signed", "attack"] = "signed"
    side: Literal["BUY", "SELL"] = "BUY"
    price: str | None = Field(None, description="decimal price, e.g. '250.10'; default = touch")
    qty: str = "10"
    desk: int = Field(1, ge=1, le=16)
    attack: str | None = Field(None, description=f"one of {ATTACK_KINDS}")


def parse_fixed(s: str) -> int:
    """Decimal string → fixed-point int without touching floats."""
    s = s.strip()
    neg = s.startswith("-")
    whole, _, frac = s.lstrip("+-").partition(".")
    ok = (whole.isdigit() or (whole == "" and frac)) and (frac == "" or frac.isdigit()) and len(frac) <= 4
    if not ok:
        raise HTTPException(422, f"invalid fixed-point value {s!r}")
    v = int(whole or "0") * P.SCALE + int((frac + "0000")[:4])
    return -v if neg else v


@app.post("/api/trade/inject")
async def inject(req: InjectReq) -> dict:
    h = require_engine()
    if req.mode == "attack":
        kind = (req.attack or "FORGE").upper()
        if kind not in ATTACK_KINDS:
            raise HTTPException(422, f"unknown attack {kind}")
        return await h.adv.inject(kind)

    side = 0 if req.side == "BUY" else 1
    qty = parse_fixed(req.qty)
    if req.price:
        px = parse_fixed(req.price)
    else:
        l2 = h.state.l2
        book = (l2["asks"] if side == 0 else l2["bids"]) if l2 else []
        if not book:
            raise HTTPException(409, "no opposite liquidity; specify a price")
        # marketable limit: opposite touch ± a 5-tick collar, so a touch that moved since
        # the last 10 Hz snapshot still crosses; fills print at the resting orders' prices
        collar = 5 * P.TICK
        px = book[0][0] + collar if side == 0 else max(P.TICK, book[0][0] - collar)
    if px % P.TICK:
        raise HTTPException(422, f"price must be a multiple of the {P.fmt_px(P.TICK)} tick")
    desk = h.client.desk_by_pid[req.desk]
    fut = asyncio.get_running_loop().create_future()
    oid, wire, sign_us = await h.client.send_signed_order(desk, side, px, qty, waiter=fut)
    try:
        res = await asyncio.wait_for(fut, 2.0)
    except asyncio.TimeoutError:
        h.state.waiters.pop(oid, None)
        return {"id": oid, "verdict": "TIMEOUT"}
    ev = res["event"]
    h.state.log_line("info", "MANUAL", f"{desk.label} {req.side} {P.fmt_qty(qty)} @ {P.fmt_px(px)} "
                     f"#{oid} → {ev.get('why', 'ACCEPTED')} ({len(res['fills'])} fills)")
    return {"id": oid, "desk": desk.label, "side": req.side, "px": px, "qty": qty, "wire": wire,
            "client_sign_us": round(sign_us, 1), "alg": "ML-DSA-87" if h.nist_level == 5 else "ML-DSA-65",
            "verdict": ev.get("why", "ACCEPTED"), "engine": ev, "fills": res["fills"]}


class HarvestReq(BaseModel):
    kem_level: Literal[768, 1024] | None = None
    frames: int = Field(64, ge=1, le=512)


@app.post("/api/threat/harvest-sim")
async def harvest_sim(req: HarvestReq) -> dict:
    h = H()
    level = req.kem_level or (1024 if h.nist_level == 5 else 768)
    frames = h.adv.recent_frames(req.frames)
    result = await asyncio.to_thread(harvest.run, h.native, frames, level)
    if result.get("ok"):
        st = h.state
        st.log_line("warn", "HNDL", f"tap replayed {result['frames']} captured frames "
                    f"({result['plaintext_bytes']:,} B) through 3 link configurations")
        for ch in result["channels"]:
            q = ch["qday"]
            lvl = "drop" if q["status"] == "EXPOSED" else "ok"
            detail = (f"{q['orders_recovered']} orders, notional {q['notional']}" if q["status"] == "EXPOSED"
                      else q["method"])
            st.log_line(lvl, q["status"], f"{ch['channel']:<26} harvested {ch['harvested_bytes']:>7,} B → {detail}")
    return result


class KemReq(BaseModel):
    level: Literal[768, 1024] = 768


@app.post("/api/kem/handshake")
async def kem_handshake(req: KemReq) -> dict:
    """One real FIPS 203 ML-KEM session establishment (keygen → encaps → decaps) via liboqs."""
    return await asyncio.to_thread(kem_session, H().native, req.level)


# --------------------------------------------------------------------------- QuantumLedger

@app.get("/api/ql/cbom")
async def ql_cbom(posture: Literal["legacy", "hybrid"] = "legacy", record: bool = False) -> dict:
    """CycloneDX 1.6 CBOM for the order-entry endpoint; exports (record=true) are appended to the proof ledger."""
    import hashlib
    h = H()
    doc = quantumledger.cbom(posture)
    digest = hashlib.sha256(orjson.dumps(doc, option=orjson.OPT_SORT_KEYS)).hexdigest()
    if not record:
        return {"cbom": doc, "sha256": digest, "entry": None}
    entry = await asyncio.to_thread(h.ql.append, "CBOM export", {
        "posture": posture, "serial": doc["serialNumber"], "assets": len(doc["components"]), "sha256": digest,
        "summary": f"CycloneDX 1.6 · {posture} · {len(doc['components'])} assets · sha256 {digest[:12]}"})
    h.broadcast({"type": "QL_LEDGER", "entry": entry})
    return {"cbom": doc, "sha256": digest, "entry": entry}


@app.post("/api/ql/remediate")
async def ql_remediate() -> dict:
    """FR-4: measure X25519MLKEM768 + ML-DSA-65 on this host and append the evidence to the proof ledger."""
    h = H()
    res = await asyncio.to_thread(h.ql.remediate)
    h.broadcast({"type": "QL_LEDGER", "entry": res["entry"]})
    h.state.log_line("ok", "FR-4", res["entry"]["summary"])
    return res


@app.get("/api/ql/ledger")
async def ql_ledger() -> dict:
    return H().ql.snapshot()


class ControlReq(BaseModel):
    playback: bool | None = None
    rate: int | None = Field(None, ge=0, le=2000)
    threat_level: int | None = Field(None, ge=0, le=3)
    nist_level: Literal[3, 5] | None = None


@app.post("/api/control")
async def control(req: ControlReq) -> dict:
    h = H()
    if req.playback is not None:
        h.gen.running = req.playback
    if req.rate is not None:
        h.gen.rate = req.rate
    if req.threat_level is not None and req.threat_level != h.adv.level:
        h.adv.level = req.threat_level
        h.state.log_line("warn" if req.threat_level else "info", "THREAT",
                         f"adversary posture → {threat_name(req.threat_level)}")
    if req.nist_level is not None and req.nist_level != h.nist_level:
        await h.client.set_level(ALG_ML_DSA_87 if req.nist_level == 5 else ALG_ML_DSA_65)
    status = h.status_payload()
    h.broadcast(status)
    return status["controls"]


@app.get("/api/frame/{oid}")
async def frame(oid: int) -> dict:
    """Raw bytes of a recent order frame as the passive tap captured it (wire inspector)."""
    h = H()
    for o, f in reversed(h.adv.harvest):
        if o == oid:
            d = P.decode_new_order(f)
            return {"id": oid, "wire": len(f), "hex": f.hex(),
                    "alg": ALG_NAMES.get(d.alg, "?") if d else None, "fixed": P.NEW_ORDER_FIXED_WIRE}
    raise HTTPException(404, "frame no longer in the tap's 512-frame window")


@app.get("/api/state")
async def state() -> dict:
    return H().snapshot()


@app.get("/api/health")
async def health() -> dict:
    h = H()
    return {"engine_connected": h.client.connected, "keys": h.state.keys_registered,
            "liboqs": h.native.liboqs_version}
