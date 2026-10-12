# AetherPool — Quantum-Resilient Institutional Dark Pool & Execution Fabric

> The detailed reference for the AetherPool stack (`engine/`, `backend/`, `frontend/`, `scripts/`). Paths below
> are relative to the repository root. Start with the root [README](../README.md).

A C++20 price-time matching engine whose ingress is gated by NIST FIPS 204 **ML-DSA** signature
verification, bridged through an async Python hub to a React Three Fiber terminal. Every metric
the UI shows is measured on the running machine; nothing is synthesised for display.

```
 desks (Python, ML-DSA sign via ctypes)          adversary (tap + injector)
                │  binary frames, TCP 127.0.0.1:9001  │
                ▼                                     ▼
 ┌───────────────────────────── engine/ (C++20) ─────────────────────────────┐
 │ ingress thread ── frame decode ── PqcEngine::verify (liboqs ML-DSA-65/87) │
 │        │ verified                     │ rejected (reason, gate ns)         │
 │        ▼ SpscRing<Cmd>                ▼ SpscRing<Evt>                      │
 │ matcher thread ── OrderBook (L3, FIFO, fixed-point, zero-alloc)           │
 │        │ fills / acks / telemetry  + L2/L3 snapshots @10 Hz               │
 │        ▼                                                                   │
 │ egress thread ── NDJSON ──────────────────────────────────────────────────┼──► backend/ (FastAPI)
 └────────────────────────────────────────────────────────────────────────────┘        │ WebSocket /ws
                                                                                       ▼
                                                                         frontend/ (Vite + R3F)
```

## Quick start (macOS, Apple silicon or Intel)

Prereqs: Xcode command-line tools, CMake ≥ 3.21 (`brew install cmake` or `pip install cmake`),
Python ≥ 3.11, Node ≥ 18. OpenSSL 3 is optional but recommended for the classical baseline
(`brew install openssl@3`).

```bash
export OPENSSL_ROOT_DIR="$(brew --prefix openssl@3)"   # optional, see "Classical baseline"
./scripts/dev.sh                                        # builds what's missing, runs all three
open http://127.0.0.1:5173
```

Or run each tier yourself:

```bash
# 1. engine — first configure fetches liboqs 0.14.0 (ML-KEM/ML-DSA only, ~1 min)
cmake -S engine -B engine/build -DCMAKE_BUILD_TYPE=Release -DOPENSSL_ROOT_DIR="$OPENSSL_ROOT_DIR"
cmake --build engine/build -j
ctest --test-dir engine/build --output-on-failure
./engine/build/aether_engine            # --port 9001 --bench-iters 400 --tick 100 --max-orders 1048576

# 2. bridge
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000

# 3. UI
cd frontend && npm install && npm run dev
```

## Tier 1 — `engine/`

| file | what |
|---|---|
| `include/aether/OrderBook.hpp`, `src/OrderBook.cpp` | L3 book. Dense tick-indexed level array (65,536 ticks/side), two-level bitmap for O(1) next-best-price, intrusive FIFO lists in a pre-allocated `IndexPool`, open-addressed `OrderId → slot` index with backward-shift delete. `insert_order`, `cancel_order`, `match_crossing_orders` never allocate. Prices and quantities are `int64` fixed-point, scale 10,000. |
| `include/aether/RingBuffer.hpp` | Cache-line-separated SPSC ring with cached head/tail. Ingress→matcher and matcher→egress. |
| `include/aether/PqcEngine.hpp`, `src/PqcEngine.cpp` | Verification gate on top of liboqs' C API: algorithm policy → participant/key lookup → **constant-time key-fingerprint check** → timestamp window → ML-DSA verify over the canonical digest → per-participant monotonic-id replay check. Records verify ns and hardware timer ticks per message. Also ML-DSA / ML-KEM micro-benchmarks. |
| `include/aether/OrderDigest.hpp` | `SHA3-256("AETHERPOOL/ORDER/v1" ‖ kind ‖ id ‖ participant ‖ side ‖ price ‖ qty ‖ ts)` — the one message both signer and verifier use. Side and participant are bound too, so a captured signature can't be replayed with the direction flipped. |
| `src/ClassicalBaseline.cpp` | ECDSA-P256, RSA-2048 and ECDH-P256 measured on the same core for the comparison panel. |
| `src/Bridge.cpp` | The engine process: TCP `127.0.0.1:9001`, binary ingress frames (`include/aether/Wire.hpp`), NDJSON egress (`HELLO`, `BENCH`, `ACK`, `TRADE`, `CXL`, `REJ`, `L2`, `TEL_IN`, `TEL_MATCH`, `HB`). |
| `src/capi.cpp` → `libaetherpqc.dylib` | C ABI for the Python clients: ML-DSA keygen/sign over the same digest, ML-KEM keygen/encaps/decaps. |
| `tests/` | Order book unit tests + a 200k-op randomised differential test against a `std::map` reference book; PQC gate tests for every reject path. |

Measured on an Apple M4 (`aether_engine` startup benchmark, medians, 400 iterations):

| | verify | sign | signature | public key | signed order frame |
|---|---|---|---|---|---|
| ECDSA-P256 (OpenSSL 3.0) | 34 µs | 13 µs | 72 B | 65 B | 131 B |
| RSA-2048 (OpenSSL 3.0) | 10 µs | 331 µs | 256 B | 270 B | 315 B |
| ML-DSA-65 (liboqs 0.14) | 58 µs | 204 µs | 3,309 B | 1,952 B | 3,368 B |
| ML-DSA-87 (liboqs 0.14) | 95 µs | 251 µs | 4,627 B | 2,592 B | 4,686 B |

Under sustained load at ~2,000 msg/s the live gate holds ML-DSA-65 verify at p50 ≈ 62 µs / p99 ≈ 72 µs
and the matcher at p50 ≈ 160–250 ns per order (insert + uncross).

## Tier 2 — `backend/`

* `engine_client.py`: `EngineClient` (provisions 16 desks × {ML-DSA-65, ML-DSA-87} keys, then
  streams frames), `LoadGenerator` (mean-reverting flow, 0–2,000 msg/s, every message signed on
  worker threads via `libaetherpqc`), `Adversary` (passive wire tap + 8 active attack vectors).
* `harvest.py`: harvest-now-decrypt-later over the frames the tap actually captured.
* `quantumledger.py`: QuantumLedger auditor. CycloneDX 1.6 CBOM (`GET /api/ql/cbom?posture=&record=`),
  FR-4 remediation evidence measured on this host: X25519MLKEM768 hybrid exchange + ML-DSA-65 sign/verify
  (`POST /api/ql/remediate`), and an RFC 6962 SHA-256 Merkle proof log whose root is signed with Ed25519 and
  ML-DSA-65 after every append, with the newest leaf's inclusion proof re-verified (`GET /api/ql/ledger`).
  The legacy RSA-2048/TLS 1.2 and "OpenSSL 3.5 hybrid terminator" deployments are modelled.
* `agents/market_simulator.py`: cryptographic network agents. `NIST_MLDSA_Agent` is the main flow
  (institutional blocks, every order ML-DSA signed); `Paranoid_MLKEM_Agent` runs a fresh ML-KEM handshake on a
  worker thread before each of its rare orders and publishes it as `KEM_HANDSHAKE`. Each order carries its agent
  on `ORDER_FLOW`; the UI renders it with FIX tag `5000=CRYPTO_STATE`. `POST /api/kem/handshake` runs one handshake on demand.
* `main.py`: `/ws` streams `SNAPSHOT`, `L2_DEPTH`, `EXECUTION_TICK`, `CRYPTO_TELEMETRY`,
  `ATTACK_LOG`, `ENGINE_STATUS`. REST: `POST /api/trade/inject` (signed order or attack, returns the
  engine's verdict and fills), `POST /api/threat/harvest-sim`, `POST /api/control`
  (playback / rate / threat level / NIST level), `GET /api/state`, `GET /api/health`.

| attack | what is sent | engine verdict |
|---|---|---|
| ECDSA | valid ECDSA-P256 signature over the canonical digest | `CLASSICAL_SIG_REJECTED` |
| TAMPER | legitimate ML-DSA signature, price rewritten in flight | `BAD_SIGNATURE` |
| FORGE | random signature bytes | `BAD_SIGNATURE` |
| SPOOF | attacker's own ML-DSA key claiming a desk | `KEY_FINGERPRINT_MISMATCH` |
| REPLAY | a harvested legitimate frame, re-sent | `REPLAY` (or `STALE_TIMESTAMP`) |
| STALE | correctly signed, timestamp 30 s old | `STALE_TIMESTAMP` |
| DOWNGRADE | ML-DSA-65 while policy requires ML-DSA-87 | `DOWNGRADE_BELOW_POLICY` |
| ROGUE | unprovisioned participant | `UNKNOWN_PARTICIPANT` |

Any adversarial message the engine ACKs is logged as a `BREACH`; the counter is shown in the HUD.

## Tier 3 — `frontend/`

Vite + React + TypeScript + React Three Fiber.

* `src/LiquiditySurface.tsx`: live L2 surface: x = price (±48 ticks around mid), y = resting quantity at
  that level (linear), z = 96 snapshots (9.6 s). One `Float32Array` position/colour buffer shared by a
  row/column wire lattice and a faint fill; fills plotted as nodes on their (price, time, qty) cell; low-opacity
  Cartesian frame with tabular price/volume/time labels.
  `components/QuantumLedger.tsx`: CII probe (CBOM status/export, Mosca X + Y > Z with editable assumptions),
  FR-4 console, and the Merkle proof ledger tab.
  `components/PqcPanels.tsx`: the bottom drawer's ML-KEM handshake tab (real timings) and HNDL terminal tab.
* `src/components/FixTape.tsx`: inbound orders / cancels (bridge `ORDER_FLOW`) and fills parsed into
  FIX 5.0 business fields. `DepthLadder.tsx`: L2 ladder. `NetProfiler.tsx` + `src/net.ts`: how one signed
  order maps onto IP packets at MTU 1500 / 9000. `CommandBar.tsx`: FR-4 console + drawer tabs.
  `WireInspector.tsx`: byte-level breakdown of a captured order frame.

## What is real and what is simulated

* **Real:** all signing, verification, KEM and AES-GCM operations; every latency, size, rate,
  memory and reject figure; the order flow (synthetic intent, but genuinely signed, verified and matched).
* **Simulated, and labelled in the UI:** Q-day in the harvest sim. No cryptographically relevant
  quantum computer exists, so the X25519 column uses an oracle that hands over the private scalar
  in place of Shor's algorithm. The decryption after that is real. The ML-KEM column has no oracle to
  substitute; its "attack" is 64 real decapsulations under guessed keys, every one of which fails AES-GCM authentication.
* **Estimated, and labelled:** CPU cycles on Apple silicon. User space cannot read the PMU cycle
  counter, so the engine measures `mach_absolute_time` ticks (24 MHz) and reports cycles as
  wall time × the published peak P-core clock. On x86-64 it reads the TSC.
* **Wire-size figures** come from the actual objects. Session establishment is
  656 B for ECDHE-P256 + RSA-2048, 7,533 B for ML-KEM-768 + ML-DSA-65, and 10,355 B (10.1 KiB)
  for ML-KEM-1024 + ML-DSA-87.
* **Classical baseline:** OpenSSL 3 if CMake finds it (`OPENSSL_ROOT_DIR`); otherwise macOS
  Security.framework, whose SecKey API adds ~1 ms of per-call overhead to EC operations and makes
  ECDSA look ~40× slower than it is. The backend in use is printed next to every number.
* **Constant-time:** the key-fingerprint binding uses `ct_equal`. ML-DSA verification handles only
  public data; secret-dependent timing matters for *signing*, which runs client-side in liboqs.
* The selector reads "ML-KEM-768". The brief's "ML-KEM-716" is not a FIPS 203 parameter set.
