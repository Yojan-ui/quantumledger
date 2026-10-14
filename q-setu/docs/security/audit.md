# Security audit (phase 0)

Branch `security-hardening`, from `wow-pass` (commit d92a30f). Scope: `q-setu/apps/web` (the site and API), the
packages it bundles, and the repository's history. Method: reading every route handler, the
middleware/config, the server libraries, and the tools below.

## 1. The 10 worst risks, ranked

| #   | Risk                                                                                                                                                                                                   | Kind                     | Where                                    | Why it ranks here                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Every rate limit can be bypassed.** `clientKey()` trusts the first `X-Forwarded-For` value, which the client controls.                                                                               | Abuse, auth              | `lib/live/rate-limit.ts`                 | An attacker rotates the header and gets unlimited scans, admin password guesses and signup emails. Rank 1 because it voids every other limit.                                                                                                                                                 |
| 2   | **The admin login can be brute-forced, and its session never expires.**                                                                                                                                | Auth                     | `api/admin/login`, `lib/server/admin.ts` | The 5-per-15-min limit is keyed by #1. The cookie is a fixed HMAC of the password: a stolen cookie works until the password changes. Behind it sits the signup export (PII).                                                                                                                  |
| 3   | **Anyone can change shared demo state from anywhere.** There is no session, no Origin/CSRF check and no limit on `reset-all`, `policy`, `keys/rotate`, `ledger/tamper`, `vault/*/tamper`, `room/send`. | Abuse, CSRF              | 20 mutating routes                       | A script (or a page another site makes your browser load) can reset or deface every visitor's demo in a loop.                                                                                                                                                                                 |
| 4   | **The URL scanner leaks internal error text, has no overall deadline and no daily cap.**                                                                                                               | SSRF-adjacent, info leak | `api/scan/url`, `lib/live/tls.ts`        | It already blocks private IPs, pins the checked IP and speaks TLS only on 443 (no HTTP, no redirects, no body). But `e.message` (`ECONNREFUSED 1.2.3.4:443`, resolver errors) reaches the client. That makes the scanner an oracle about the network, and the 6/min cap has no daily ceiling. |
| 5   | **No browser security headers.** No CSP, HSTS, X-Content-Type-Options, frame-ancestors (clickjacking), Referrer-Policy or Permissions-Policy.                                                          | Injection, clickjacking  | `next.config.mjs` (no middleware)        | Any future XSS runs unrestricted. The admin page and the demo controls can be framed.                                                                                                                                                                                                         |
| 6   | **Vulnerable and unpinned dependencies.** `pnpm audit`: 2 critical, 3 high, 6 moderate, 1 low. All 82 direct dependency entries use `^`/`~` ranges, and nothing checks them on PRs.                    | Supply chain             | `package.json` ×10, lockfile             | The criticals (tinypool via vitest) and highs (postcss via next's build, braces via eslint) are dev/build-time, not served. But an unpinned range is exactly how a hijacked release lands (the npm worm / Hugging Face pattern).                                                              |
| 7   | **Unthrottled CPU-heavy endpoints.** `bench`, `ledger/verify` (~2 s on a large chain), `qday`, `scan` (256 KB of regex), `certs/issue`, `traffic`, `plan` (unbounded strings).                         | Abuse (DoS)              | 7 routes                                 | A few concurrent loops pin the single Node process.                                                                                                                                                                                                                                           |
| 8   | **Unlimited SSE connections.** `/api/stream`, `/api/room/stream`.                                                                                                                                      | Abuse (DoS)              | 2 routes                                 | Each open connection holds a socket and a subscription; there is no per-IP cap.                                                                                                                                                                                                               |
| 9   | **The signup form sends email to any address.**                                                                                                                                                        | Abuse, reputation        | `api/early-access` + Resend              | With #1, a bot can make the domain send confirmation mail to arbitrary inboxes, which damages sender reputation. It also stores PII.                                                                                                                                                          |
| 10  | **Third-party data flows.** Scanned hosts' IPs go to ip-api.com over **plain HTTP**. The optional Plausible script loads from a CDN with no integrity check.                                           | Supply chain, privacy    | `lib/live/geo.ts`, `app/layout.tsx`      | A network attacker can alter geo results. A compromised CDN script would run on every page (to be bounded by CSP; SRI isn't possible for a script Plausible updates in place).                                                                                                                |

Also noted, lower risk:

- Schemas strip unknown keys instead of rejecting them, and four bodies (`certs/issue`, `sdk/[step]`, `proof/[id]/verify`, `vault/[id]/tamper` ids) aren't validated by a schema.
- The room's join URL can come from `X-Forwarded-Host` when no site URL is set (reflected only to the sender).

## 2. The URL scanner today

`POST /api/scan/url` → `scanHost` → `probeTls` (`lib/live/tls.ts`):

- **Input:** accepts `http(s)://host` or a bare host. Any other scheme is rejected; so are credentials in the URL, `localhost`, `.local`/`.internal`/`.lan`/`.home`/`.corp`, single-label names, and private literal IPs.
- **DNS:** resolves itself (`dns.lookup`, all records) and refuses if _any_ address is private. The private ranges are loopback, RFC 1918, link-local incl. 169.254.169.254, CGNAT, multicast, reserved, `::`, `::1`, `fc00::/7`, `fe80::/10`, IPv4-mapped and NAT64.
- **Connection:** connects to the first checked address (the hostname is only the TLS SNI), so a rebinding DNS answer can't swap the target. Port 443 only, TLS handshake only, 6 s socket timeout, `rejectUnauthorized: false` because it describes the server rather than trusting it.
- **No HTTP is spoken.** No request is sent, no body is read and no redirect is followed. The 1 MB and redirect rules therefore hold trivially; phase 1 keeps it that way and documents it.
- **Gaps (phase 1):** internal error text in responses; no overall 5 s deadline (DNS plus connect can exceed it); a limit of 6/min with no daily cap, keyed by a spoofable IP; tests don't yet cover the attack list.

## 3. Inventory

### API routes (43)

| Route                       | Methods   | Validation | Rate limit | Risk                                                                                                                                                                      |
| --------------------------- | --------- | ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/.well-known/security.txt` | GET       | -          | -          | Low: static contact text. Missing on Vercel if SECURITY_CONTACT unset.                                                                                                    |
| `/api/admin/login`          | POST      | form       | 5/15 min   | **Auth.** Password check is constant-time, but the limit is keyed by a spoofable X-Forwarded-For (brute force), and the session token is a fixed HMAC that never expires. |
| `/api/admin/signups.csv`    | GET       | -          | -          | **Secrets/PII.** Exports every signup (names, emails). Guarded by the admin cookie only.                                                                                  |
| `/api/bench`                | GET       | zod        | -          | **Abuse.** Runs real crypto benchmarks on the server: CPU per request, unthrottled.                                                                                       |
| `/api/certs/[id]`           | GET       | -          | -          | Low: reads one demo certificate.                                                                                                                                          |
| `/api/certs/issue`          | POST      | -          | -          | **Abuse/injection.** Signs a demo certificate; body not schema-validated; unthrottled CPU (ML-DSA).                                                                       |
| `/api/certs/issuer`         | GET       | -          | -          | Low: public key.                                                                                                                                                          |
| `/api/docs`                 | GET       | -          | -          | Low: the OpenAPI document.                                                                                                                                                |
| `/api/early-access`         | POST      | zod        | 5/10 min   | **Abuse/PII.** Stores name, email, organisation; sends an email to any address (inbox spam from our domain). Limit keyed by spoofable XFF.                                |
| `/api/harvest`              | GET       | zod        | -          | Low: simulated records.                                                                                                                                                   |
| `/api/health`               | GET       | -          | -          | Low.                                                                                                                                                                      |
| `/api/keys`                 | GET       | -          | -          | Low: public key metadata only.                                                                                                                                            |
| `/api/keys/rotate`          | POST      | zod        | -          | **Abuse.** Rotates the shared demo KMS keys for every visitor; no session, Origin or limit.                                                                               |
| `/api/ledger`               | GET       | zod        | -          | Low: reads entries (limit ≤ 200).                                                                                                                                         |
| `/api/ledger/tamper`        | POST      | zod        | -          | **Abuse.** Edits the shared Proof Chain row #42 (by design, a demo), but anyone can do it from anywhere, at any rate.                                                     |
| `/api/ledger/verify`        | POST      | -          | -          | **Abuse.** Verifies the whole chain (~2 s CPU on a big chain); unthrottled.                                                                                               |
| `/api/metrics`              | GET       | -          | -          | Low.                                                                                                                                                                      |
| `/api/plan`                 | POST      | zod        | -          | **Abuse.** Up to 2,000 findings whose string fields have no max length (memory).                                                                                          |
| `/api/policy`               | GET, POST | zod        | -          | **Abuse.** Changes the live policy (L1/L3/L5) for everyone.                                                                                                               |
| `/api/proof/[id]/verify`    | POST      | -          | -          | Abuse: CPU; id not schema-validated.                                                                                                                                      |
| `/api/proof/anchor`         | POST      | zod        | limited    | Abuse: appends signed ledger entries.                                                                                                                                     |
| `/api/qday`                 | POST      | zod        | -          | Abuse: CPU (breaks tiny RSA).                                                                                                                                             |
| `/api/qsetu/key`            | GET       | -          | -          | Low: public key.                                                                                                                                                          |
| `/api/reset-all`            | POST      | -          | -          | **Abuse.** Resets every demo for every visitor; no session, Origin or limit.                                                                                              |
| `/api/reset`                | POST      | zod        | -          | Abuse: resets a sector.                                                                                                                                                   |
| `/api/room/join`            | POST      | zod        | limited    | Abuse: room membership.                                                                                                                                                   |
| `/api/room`                 | GET       | -          | -          | Low; join URL falls back to the Host / X-Forwarded-Host header when no site URL is set.                                                                                   |
| `/api/room/send`            | POST      | zod        | -          | **Abuse.** Broadcasts to everyone watching the room (big screen); unthrottled.                                                                                            |
| `/api/room/stream`          | GET       | -          | -          | **Abuse.** SSE; unlimited concurrent connections.                                                                                                                         |
| `/api/scan`                 | POST      | zod        | -          | Abuse: scans up to 256 KB of text (regex CPU); unthrottled.                                                                                                               |
| `/api/scan/url`             | POST      | zod        | 6/min      | **SSRF.** See section 2.                                                                                                                                                  |
| `/api/sdk/[step]`           | GET, POST | -          | -          | Abuse/injection: demo SDK steps; bodies not schema-validated.                                                                                                             |
| `/api/seal-from`            | POST      | zod        | limited    | Abuse: real seals on the mesh.                                                                                                                                            |
| `/api/shield/run`           | POST      | zod        | -          | Abuse: drives the local Shield demo processes (fixed localhost URLs, no user-controlled URL).                                                                             |
| `/api/simulate`             | POST      | zod        | -          | Abuse: up to 20 simulated sends per call.                                                                                                                                 |
| `/api/stream`               | GET       | zod        | -          | **Abuse.** SSE; unlimited concurrent connections.                                                                                                                         |
| `/api/traffic`              | POST      | zod        | -          | Abuse: real crypto per call.                                                                                                                                              |
| `/api/vault/[id]`           | GET       | -          | -          | Low: one demo record.                                                                                                                                                     |
| `/api/vault/[id]/tamper`    | POST      | -          | -          | Abuse: edits a stored demo record; id not schema-validated.                                                                                                               |
| `/api/vault`                | POST      | zod        | -          | Abuse: stores records (storage growth).                                                                                                                                   |
| `/api/web-shield/submit`    | POST      | partial    | -          | Abuse/injection: decrypts posted envelopes.                                                                                                                               |
| `/og`                       | GET       | -          | -          | Low: renders query text into an image (length-capped).                                                                                                                    |
| `/og/seal`                  | GET       | -          | -          | Low: validated number and enum.                                                                                                                                           |

Server actions: **none** (no `"use server"` anywhere).

### Environment variables

| Variable                                                                                                              | Secret?               | Used for                     | Notes                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------- | --------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `QSETU_KMS_KEK`                                                                                                       | **Yes**               | wraps every KMS key          | Without it a KEK file is written to `QSETU_DATA_DIR` (local `.data/kms.kek`, git-ignored, never committed). |
| `ADMIN_PASSWORD`                                                                                                      | **Yes**               | admin login and session HMAC | ≥ 12 characters, else admin is off.                                                                         |
| `RESEND_API_KEY`                                                                                                      | **Yes**               | confirmation email           | Optional.                                                                                                   |
| `DATABASE_URL`                                                                                                        | **Yes**               | Postgres (else SQLite)       | Contains the DB password.                                                                                   |
| `QSETU_WEB_SHIELD_SEED`                                                                                               | **Yes**               | Web shield demo key seed     | Falls back to a public demo seed.                                                                           |
| `RESEND_FROM`, `SECURITY_CONTACT`, `QSETU_ROTATE_MS`, `QSETU_DATA_DIR`, `QSETU_JOIN_URL`, `QSETU_OFFLINE`, `NODE_ENV` | No                    | config                       |                                                                                                             |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_OFFLINE`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_PLAUSIBLE_SRC`            | No (public by design) | browser config               | None of the `NEXT_PUBLIC_` variables holds anything sensitive.                                              |

### External fetches (server)

| Destination                                | From                                           | User-controlled?                  | Risk                                           |
| ------------------------------------------ | ---------------------------------------------- | --------------------------------- | ---------------------------------------------- |
| Any public host, TLS on :443               | `lib/live/tls.ts` (scanner)                    | **Yes**, the hostname             | SSRF (section 2)                               |
| `http://ip-api.com/json/<ip>`              | `lib/live/geo.ts`                              | The IP (already validated public) | Plain HTTP; leaks scanned IPs to a third party |
| `https://api.resend.com/emails`            | `lib/server/email.ts`                          | The recipient address             | Email abuse (#9)                               |
| `http://127.0.0.1:8443/8080` (Shield demo) | `lib/server/shield-stack.ts`, `api/shield/run` | No (fixed)                        | Low                                            |

### Third-party scripts (browser)

| Script                                                | Loaded                                                   | Notes                                                         |
| ----------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| Plausible (`plausible.io/js/script.tagged-events.js`) | Only if `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set            | No SRI (updated in place by Plausible); to be bounded by CSP. |
| Everything else                                       | Bundled first-party; fonts via `next/font` (self-hosted) |                                                               |

### Dependencies

82 direct dependency entries across 10 `package.json` files. All use `^`/`~` ranges; the lockfile (`pnpm-lock.yaml`) is committed.
Lifecycle scripts are already restricted to five packages by `onlyBuiltDependencies` (better-sqlite3, esbuild,
ffmpeg-static, sharp, unrs-resolver). Packages that look unused (`@react-three/postprocessing`, `postprocessing`,
others) are checked in phase 5.

## 4. Tool results

### `pnpm audit` (2026-10-14)

2 critical, 3 high, 6 moderate, 1 low, all transitive.

| Severity    | Package                                                                     | Path                            | Served at runtime?  |
| ----------- | --------------------------------------------------------------------------- | ------------------------------- | ------------------- |
| critical ×2 | tinypool ≤ 2.1.0 (prototype pollution → RCE)                                | vitest → tinypool               | No (tests)          |
| high ×2     | postcss ≤ 8.5.17 (file read, source-map traversal)                          | next → postcss                  | No (build-time CSS) |
| high        | braces ≤ 3.0.3 (stack-exhaustion DoS)                                       | eslint-config-next → … → braces | No (lint)           |
| moderate ×6 | esbuild dev server, postcss, postcss-selector-parser, vitest/@vitest/mocker | dev tooling                     | No                  |
| low         | esbuild dev server file read                                                | tsup → esbuild                  | No                  |

None is reachable from a request to the production server, but all should be fixed (phase 5).

### Secrets: gitleaks 8.30.1 (official release, checksum-verified)

- **Full git history (`--all`, 48 commits):** 6 findings, all `generic-api-key` in `apps/web/data/scan-cache.json`. They are the
  text `key_exchange_group = X25519MLKEM768` (and `X25519`) in cached TLS scan reports: **false positives**.
- **No real secret has ever been committed.** `.env` files and `.data/` (the local KEK and keystore) are git-ignored, and
  `git log --all -- '**/.data'` is empty. Nothing needs rotating (see `rotate.md`, phase 2).
- **Working tree:** the only real secrets on disk are the local demo KMS files in `apps/web/.data/` (`kms.kek`,
  `keystore.json`, mode 600), which are ignored.
