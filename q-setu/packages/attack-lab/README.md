# @qsetu/attack-lab

A defensive analysis tool for sites protected by Shield. It records the requests Shield's risk engine
flags, signs that evidence so it can't be changed unnoticed, maps how each attack unfolded, groups
attacks into patterns, and replays saved attacks against a local sandbox to check our own defences.
It observes and replays. It does not attack anything.

```bash
pnpm --filter @qsetu/attack-lab-ui dev   # engine, sandbox and API (127.0.0.1:4100) plus the dashboard (127.0.0.1:3100)
pnpm --filter @qsetu/attack-lab dev      # engine, sandbox and API only
ATTACK_LAB_SEED=1 …                      # on an empty store, send labelled test traffic first
```

## The flow

1. **Detect** (`src/detect.ts`). Shield's Express middleware runs as shipped. A small middleware in
   front of it opens a per-request context, and Shield's `onEvent` hook fills it in. When the response
   finishes, the lab has a structured event with the time, a hashed source IP and network block, the
   ASN (if a lookup is configured), the JA4 fingerprint (only behind Shield Edge), the route, the
   signals that fired, the risk score, and what Shield did. Bot and AI-agent behaviour, honeypots, the
   trap link and canary keys all reach the lab through this hook. Shield has no separate WAF rule
   set; its header-consistency rules and tripwires play that part. If a WAF is added, it can send
   events through the same hook.
2. **Record** (`src/store.ts`). Each event becomes a read-only record in an append-only log
   (`.data/records.jsonl`). Records are frozen in memory, and the store has no update or delete.
   Events from the same IP hash or session hash within 30 minutes are linked into one incident. Once
   an incident is open, the source's other requests are kept too, along with up to 20 requests from
   just before the first flag, so the timeline has context.
3. **Sign** (`src/sign.ts`). Every record is signed with ML-DSA-65 (FIPS 204) and chained to the
   record before it by SHA-256. This is the same scheme as Shield's signed asset manifest: canonical
   JSON and a domain prefix. The key is a Shield identity file, loaded with the proxy's own loader.
   Each incident is re-sealed a moment after it changes, and the seal covers the hashes of all its
   events. `GET /api/verify` re-checks every hash, signature and link, and editing the file shows up
   there. ML-DSA is a post-quantum signature, so the evidence can't be forged later by an attacker
   with a quantum computer.
4. **Map** (`src/timeline.ts`). Each incident becomes a timeline: every step's offset, method,
   route, route class, phase (browse, recon, probe, credential, abuse, refused), signals, score and
   Shield's action, plus where Shield first refused.
5. **Pattern** (`src/patterns.ts`). Incidents are grouped by named rules, checked in order: leaked-key
   use, search-engine impersonation, secrets probe, admin and CMS scan, hidden-link crawler, AI-agent
   crawl, API flood, route enumeration, and other. Each pattern has a count and a last-seen time.
6. **Replay** (`src/replay.ts`, `src/sandbox.ts`). Pick an incident, and its steps are sent in order,
   with their pacing (gaps capped at 400 ms), to a fresh pair of `apps/legacy-bank` copies on
   loopback: one bare, one with Shield in protect mode. The result shows, side by side, what each one
   did with every step.

## Safety rules

- **Replay and test traffic go to this machine only.** `assertSandbox` (`src/hostguard.ts`) allows
  only `localhost`, `127.0.0.1` and `::1`, which covers the sandbox and the legacy-bank demo on its
  default port. It refuses every other host before anything is sent. Routes are joined to the origin
  by concatenation, so a path like `//elsewhere.example` stays on the sandbox. Redirects are not
  followed.
- **It tests our own defences only.** It never points at anyone else's systems. All servers bind to
  127.0.0.1.
- **Privacy:** no request bodies, query strings, cookies or headers are stored, apart from the client
  family (for example "script" or "ai-agent"). IPs and session cookies are kept only as keyed HMAC
  hashes; the salt stays in `.data/salt`. Canary keys are masked in routes.
- **Test traffic is labelled.** It carries `x-attack-lab-synthetic: 1` and uses documentation-range
  addresses (RFC 5737), and its records show as "test traffic". The label is only for display: anyone
  could send that header, so it isn't a security signal.
- **No claim of being unbreachable.** Shield raises the cost of abuse and makes it noisy. A careful,
  human-paced agent running a real browser can still look like a person, and a replay shows only how
  our defences treat the recorded steps.

## What's real and what's stubbed

| part                                                                                                         | state                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detect from Shield's engine (honeypot, trap, canary, rate, routes, errors, burst, headers, fake search bots) | Works: the real `@qsetu/shield` middleware                                                                                                                                 |
| ASN                                                                                                          | Hook only (`asnOf`); no ASN data is bundled                                                                                                                                |
| JA4 TLS fingerprint                                                                                          | Read from Shield Edge's `x-qsetu-ja4` when `trustEdgeHeaders` is set. The sandbox is plain HTTP, so sandbox events have none, and replays can't reproduce one              |
| Signing, chain and verification                                                                              | Works, ML-DSA-65                                                                                                                                                           |
| Replay                                                                                                       | Reproduces method, route, order, pacing and client family. Bodies were never recorded, so writes send `{}`. One documentation address stands in for the source             |
| Shield's PQC tunnel (`shield-proxy`)                                                                         | Only its identity loader is reused. The protected sandbox runs Shield as middleware, not behind the tunnel, because the tunnel doesn't change what the risk engine decides |
| Storage                                                                                                      | One local JSONL file. No rotation, retention or export yet                                                                                                                 |
| Fake-Googlebot test traffic                                                                                  | Shield checks the claim with a reverse-DNS lookup of a documentation address through the system resolver. That is the only lookup that leaves the machine                  |

## Customers and the website's /lab

Every event carries a `site`, the protected customer site it was sent to. Incidents never mix sites.
`customers.json` (in the lab's data directory) maps each customer to their site, the addresses that
may sign in as them, and the team's note and readiness score for them. Two fictional demo customers
are seeded. The sandbox stands in for both: test traffic names its site in `x-attack-lab-site`. That
is sandbox only, and a real install records one fixed site.

The website's signed-in `/lab` area (apps/web) reads this API. The API has no users of its own, so
the website decides on the server who may see which site. Set `ATTACK_LAB_TOKEN` on both sides so
that only the website can call it.

## Configuration

| env                                                       | default                                                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `ATTACK_LAB_DIR`                                          | `packages/attack-lab/.data` (git-ignored)                                                                                                   |
| `ATTACK_LAB_IDENTITY`                                     | `<dir>/identity.json`, created 0600 on first run. Point it at an existing Shield identity (`qsetu-shield --identity`) to sign with that key |
| `LAB_PORT`, `SANDBOX_BARE_PORT`, `SANDBOX_PROTECTED_PORT` | 4100, 4101, 4102                                                                                                                            |
| `ATTACK_LAB_API` (dashboard)                              | `http://127.0.0.1:4100`                                                                                                                     |
