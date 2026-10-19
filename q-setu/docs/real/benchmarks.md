# Shield benchmarks

**Setup.** Measured on 14 Oct 2026:

- Apple M4, macOS, Node 24.21.0 with OpenSSL 3.5.8;
- everything on loopback, so the numbers are processing cost, not network distance;
- the origin is the legacy bank app (`apps/legacy-bank`) in its own process;
- Shield Edge is in its own process, so its CPU is measured separately.

Raw results: `packages/shield-edge/bench/results.json` and `packages/shield-proxy/bench/tunnel-results.json`.

**Reproduce:**

- `pnpm --filter @qsetu/shield-edge bench`, which **fails if a budget is missed**. CI runs the quick
  version on every push.
- `pnpm --filter @qsetu/shield-proxy bench:tunnel`

## Shield Edge against the budget

| Budget (from the brief)                                                       | Measured                                             | Limit    |     |
| ----------------------------------------------------------------------------- | ---------------------------------------------------- | -------- | --- |
| Added latency, warm connection, p50                                           | **+0.060 ms** (0.050 → 0.109 ms)                     | ≤ 2 ms   | met |
| Added latency, warm connection, p95                                           | **+0.085 ms** (0.065 → 0.150 ms)                     | ≤ 10 ms  | met |
| Extra server CPU for a full X25519MLKEM768 handshake vs X25519 alone          | **+0.030 ms** (0.308 → 0.338 ms per handshake)       | ≤ 1.5 ms | met |
| Edge CPU at a steady 1,000 req/s (autocannon, 50 connections, 20 s, 0 errors) | **4.1 % of one core**                                | ≤ 10 %   | met |
| Memory per idle TLS connection                                                | **≈ 60 KiB** (RSS delta over 1,000 idle connections) | reported | —   |

How each was measured:

- **Warm connections.**
  - 3,000 sequential `GET /api/health`, alternating bare (HTTP to the origin) and through the edge (TLS
    1.3, X25519MLKEM768, keep-alive), so drift affects both equally.
  - "Added" is the edge's percentile minus the bare one.
- **Resumed connections.** A _new_ TCP + TLS connection for each request, resuming the session ticket:
  1,000 of them, all resumed. p50 is 0.628 ms and p95 is 0.734 ms for connect, handshake and the request
  together. There's no bare equivalent, since the origin has no TLS.
- **Handshake CPU.**
  - The edge process's own CPU time (`process.cpuUsage`) across 2,000 full handshakes of each kind, in
    alternating blocks of 100 after a warm-up.
  - Each includes one small request. The client side runs in another process and isn't counted.
  - The PQ client really negotiated `X25519MLKEM768`, checked from the client side.
- **Load.**
  - autocannon at `overallRate: 1000` for 20 s; the edge's CPU over that time is divided by wall time.
  - Latency under that load, which autocannon reports in whole milliseconds: through the edge, p50 1,
    p97.5 7 and p99 14 ms. Bare, p50 0, p97.5 1 and p99 2 ms.
  - So the tail is wider through the edge under load, and still inside the p95 budget.
- **Idle memory.**
  - RSS before and after opening 1,000 idle TLS connections.
  - RSS is noisy: a 200-connection run measured 7 KiB per connection. Treat about 60 KiB as an upper
    bound, not a precise figure.

For comparison, the **same exchange in today's JavaScript tunnel** (pure-JS `@noble`, ML-DSA-65 signed)
costs 54.4 ms per full handshake (`pnpm bench`, plan.md §3). Native TLS is the reason Shield Edge exists.

## Tunnel v2 vs v1 vs plain HTTPS

The Shield tunnel is for traffic between two machines over a network you don't trust (sidecar to sidecar).
All four routes reach the same origin, on loopback: 2,000 sequential GETs on a warm connection, then one
10 MB upload.

| Route                                                                          | p50      | p95      | 10 MB upload |
| ------------------------------------------------------------------------------ | -------- | -------- | ------------ |
| Direct HTTP to the origin (the floor)                                          | 0.043 ms | 0.086 ms | 2.8 ms       |
| HTTPS through Shield Edge (TLS 1.3, X25519MLKEM768)                            | 0.091 ms | 0.121 ms | 18 ms        |
| Tunnel **v1** (JSON, base64 bodies, pure-JS AES-GCM, 10 MB cap)                | 0.260 ms | 0.468 ms | 901 ms       |
| Tunnel **v2** (one HTTP/2 connection, binary frames, native AES-GCM, streamed) | 0.354 ms | 0.419 ms | **34 ms**    |

- **Bulk data: v2 is about 27× faster than v1.** It also has no size cap: a 48 MB upload passes in the
  tests, checked by hash.
- **Small requests: v2's p50 is 0.09 ms slower than v1's.** Each request is its own stream, with its own
  key derivation and three sealed frames each way. Its p95 is lower than v1's. Merging the request head
  into the first data frame would close most of the gap; that's a possible next step.
- **Plain HTTPS through the edge is faster than either tunnel.** Where the visitor's browser is the
  client, use Shield Edge, not the tunnel. The tunnel is for server-to-server links.
