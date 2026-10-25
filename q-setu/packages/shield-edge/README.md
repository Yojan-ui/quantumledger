# Shield Edge

A reverse proxy that terminates TLS with a **hybrid post-quantum key exchange (X25519MLKEM768)** in front of
any website, then forwards to your origin over a pooled keep-alive connection. It's native OpenSSL 3.5
through Node's TLS, not JavaScript cryptography.

```
visitor ──TLS 1.3, X25519MLKEM768──▶ Shield Edge ──keep-alive HTTP or TLS──▶ your origin
```

- **Key exchange.** X25519MLKEM768 whenever the client supports it, falling back to X25519 or P-256 for
  clients that don't. Current Chrome, Edge, Firefox and Safari do support it.
  - The OpenSSL group tuples `X25519MLKEM768/X25519:P-256` make the edge choose the PQ group even when a
    client sent only an X25519 key share first. That costs one extra round trip.
  - Tested against real handshakes in `test/hello.test.ts`.
- **Sessions.**
  - TLS 1.3 session tickets, with the ticket key rotated every 12 hours. A rotation reaches every
    per-domain context.
  - Keep-alive, HTTP/2 and HTTP/1.1.
  - AES-GCM first, with ChaCha20 kept for phones without AES instructions.
- **Bodies.** Streamed in both directions, never buffered whole.
- **Forwarding headers.**
  - The client's own `X-Forwarded-For`, `X-Real-IP` and `Forwarded` headers are dropped. The edge sets its
    own.
  - `X-Qsetu-Kx` tells your origin which key exchange the visitor used.
  - `Server` and `X-Powered-By` are removed from responses.
- **Per-connection metrics.** Which key exchange each connection used, resumptions, status classes and
  timing. They're in Prometheus format on the admin port, which you must keep private.
- **Certificates.**
  - Per domain, from Let's Encrypt, via the maintained `acme-client` library and HTTP-01 challenges.
  - Renewed when fewer than 30 days remain.
  - Private keys are encrypted at rest (AES-256-GCM under `SHIELD_KEK`, with the domain name bound in).

## What it does not do

- **Certificates stay classical (ECDSA P-256).** Browsers don't accept post-quantum certificates yet. The
  post-quantum protection is the key exchange, which is what a "harvest now, decrypt later" attacker
  records. It isn't the certificate signature.
- **The hop to your origin is only as strong as that hop.**
  - Use `https://` to an origin that supports X25519MLKEM768, or keep the origin on the same private network.
  - For an untrusted network between them, use the Shield tunnel (`qsetu-shield --v2`).
- **No live ACME issuance from a laptop.** Let's Encrypt issuance needs your DNS pointing at the edge and
  port 80 reachable from the internet. It has not been exercised against Let's Encrypt from this repository.

## Run it

```sh
# The container (from the repository root)
docker build -f packages/shield-edge/docker/Dockerfile -t quantumledger/shield .
docker run -p 443:8443 -p 80:8080 -v shield-data:/data \
  -e EDGE_ORIGIN=http://your-app:3000 -e EDGE_DOMAINS=www.example.com \
  -e SHIELD_KEK="$(openssl rand -base64 48)" -e ACME_EMAIL=you@example.com quantumledger/shield
```

There's also a `docker/docker-compose.yml` with the app beside it.

All settings are environment variables, listed at the top of `src/cli.ts`.

## DNS install route

1. **Prove you own the name:**
   `TXT _qsetu-challenge.www.example.com "qsetu-verify=<token from the dashboard>"`
2. **Send the traffic:**
   `CNAME www.example.com → edge.quantumledger.app`

The edge won't request a certificate for a name, or serve it, until step 1 passes (`src/onboard.ts`).

## Benchmarks

`pnpm --filter @qsetu/shield-edge bench` runs the legacy bank app behind the edge, each in its own process,
and checks the budget. The run fails if any budget is missed:

| Budget                                           | Limit             |
| ------------------------------------------------ | ----------------- |
| Added latency on warm connections, p50           | ≤ 2 ms            |
| Added latency on warm connections, p95           | ≤ 10 ms           |
| Extra server CPU per full PQ handshake vs X25519 | ≤ 1.5 ms          |
| Edge CPU at 1,000 req/s                          | ≤ 10% of one core |
| Memory per idle connection                       | reported          |

Results are in `bench/results.json` and `docs/real/benchmarks.md`.
