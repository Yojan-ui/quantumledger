# "Make it real": baseline and plan

Branch `shield-real`, from `security-hardening` (98f8e42). That branch already has the URL-scanner lockdown,
the shared API middleware (rate limits, same-origin and session checks, strict bodies, generic errors) and the
secrets review, which this pass's phase C1 builds on.

**The honesty rule.** Nothing here is called "unbreachable", "unhackable" or "100% secure". The goal is that
there are no easy wins, that attacks are slow and noisy, that attackers are caught within minutes, and that
damage is contained. Every number below is measured, and says where and how.

## 1. Baseline (phase 0)

| What | Command | Output |
| --- | --- | --- |
| Screenshots of every page at 1440 and 390 px, and horizontal overflow at 360 / 390 / 768 / 1440 | `node scripts/real-shots.mjs before` (new) | `docs/real/before/*.png`, `overflow.md`, `overflow.json` |
| Glitch audit against the production build (`pnpm build && pnpm start`) | `AUDIT_OUT=docs/real pnpm audit:glitch before` | `docs/real/audit-before.md` |
| Quick check on `pnpm dev` | a second server on :3001 with its own data directory | section 2.3 |
| Crypto cost | `pnpm bench`, plus a native-TLS handshake benchmark | section 3 |

A measurement trap found and fixed on the way: a mobile browser *widens its layout viewport* to fit content
that's too wide (a 390 px phone reported `innerWidth = 434`). Comparing `scrollWidth` with `innerWidth`
therefore hides the overflow. `real-shots.mjs` compares against the device width instead.

## 2. Glitches

### 2.1 The brief's list, checked on this branch

The list was observed on the live site (13 Oct), which runs `main`. This branch also carries the smooth and wow
passes, so each item was re-checked here.

| # | Glitch | On this branch? | Evidence |
| --- | --- | --- | --- |
| A1 | Phone header overflow: the menu button is off-screen | **Yes**, and worse than reported: **+74 px at 360, +44 px at 390, +190 px at 768**, on all 30 pages with the main nav. The cause is the nav's right-hand group (`div.flex.items-center.gap-3`: Q-Day, Simple/Technical, ⌘K, early access, menu). | `before/overflow.md`; `platform-390.png` shows no menu button |
| A2 | Diagnostics console overflow; phase tabs cut off | **Partly.** The homepage no longer has the compact HUD (the wow pass made the hero a full-bleed stage). On `/diagnostics` at 390, the five phase tabs are cut to "DET · SCO · DEF · PRO · RES". | `diagnostics-390.png` |
| A3 | `/platform` diagram 660 px wide on phones | **Yes**, as a horizontal scroller: the SVG has `min-w-panel` (640 px) inside `overflow-x-auto`. It doesn't widen the page, but the diagram scrolls sideways. | `components/platform/Architecture.tsx` |
| A4 | "THREAT CRITICAL" before anything is scanned | **Yes** on `/diagnostics`: `threat()` returns `critical` before any result. The homepage hero already shows "READY" first. | `components/hud/TopBar.tsx` |
| A5 | Placeholder clutter: `SID -------- · NODES – · G-`, `0.0 OPS/SEC` | **Yes**: TopBar line 77, LiveStrip line 76. | |
| A6 | "[ QUANTUMLEDGER: AWAITING TARGET ]" wraps on phones | **Yes**: the stage title wraps its last word and bracket (seen in the wow pass at SHELF-LIFE EXPIRING). | `components/hud/StageFrame.tsx` |
| A7 | "Waking up the server…" covers the diagnostics panel | **Partly**: it appears after 2 s (fixed bottom-left), over whatever is there. | `components/ui/ServerNote.tsx` |
| A8 | Disabled "TRY TAMPER" barely readable | **Changed by the wow pass**: it is now *invisible* until there's a block (to stop a layout shift). The brief wants it readable and disabled, with a tooltip; the space stays reserved either way. | `components/hud/PipelineStepper.tsx` |
| A9 | Phone WebGL: DPR 1.5 cap, pause when hidden, poster under reduced motion | **Partly done**: frames are drawn on demand only while a 3D area is on screen (and rAF stops in hidden tabs). The DPR cap is 1.75, not 1.5. Reduced motion shows a still 3D end state, not the poster. | `lib/client/gfx.ts` |

### 2.2 Found by the baseline

| # | Glitch | Cause |
| --- | --- | --- |
| A10 | **429 Too Many Requests in the console** (41 times across the screenshot run) | Phase 3's per-IP read limit (120/min) counts the APIs that every page fetches by itself (live stream, metrics, ledger). One fast visitor trips it, and so do many real visitors behind one carrier-grade NAT IP, which is common on Indian mobile networks. **Fix:** much higher read limits, keyed by the demo session where one exists. |
| A11 | `/demo/scanner` page error: `TypeError: Cannot read properties of undefined (reading 'length')` | A 429 from `/api/plan` (A10) was stored as if it were a plan. **Fix:** ignore non-OK replies. |
| A12 | Long main-thread tasks on phones (4× CPU): up to 717 ms during a transition on `/platform`, 594 ms on `/diagnostics`, 204 long tasks in all | Mostly first-load script and 3D work. Over the brief's 50 ms frame target at 390; the target is set for 1440, where the worst transition frame is 34 ms. |

**Glitch audit, production build** (`docs/real/audit-before.md`, all 32 routes at each width):

| | 1440 | 390 (4× CPU) |
| --- | --- | --- |
| Console + page errors | 3 (the deliberate 404, plus the A11 crash and its 429) | 1 (the deliberate 404) |
| Hydration warnings, WebGL contexts lost | 0, 0 | 0, 0 |
| Long tasks > 50 ms | 46 | 204 |
| Worst frame, scrolling / transition | 100 ms / 34 ms | 317 ms / 717 ms |
| Worst page CLS | 0.019 (`/demo/qday`) | 0.0238 |
| Failed requests | 2 | 1 |

The brief's targets are zero errors besides the 404, zero overflow, CLS under 0.05 and no transition frame
over 50 ms at 1440. At baseline, CLS and transition frames at 1440 already pass. Errors and overflow fail.

### 2.3 `pnpm dev`

Not run at baseline: a dev server alongside the production audit would have distorted its numbers. The dev
check is run with phase A's after-measurements instead.

## 3. Shield cost today

`pnpm bench` (Node 24.21.0, darwin/arm64, Apple M4, median of 50):

| Today's Shield tunnel (`packages/shield-proxy`, pure-JS `@noble` crypto) | Cost |
| --- | --- |
| Full handshake, standard profile (X25519 + ML-KEM-768, ML-DSA-65 signed) | **54.4 ms** (ML-DSA-65 sign alone: 42.9 ms) |
| Classical handshake for comparison | 12.4 ms |
| Per message (256 B, AES-256-GCM in the session) | 85 µs (plain AES-GCM: 65 µs) |
| Wire format | JSON with base64 bodies; Fastify `bodyLimit` 10 MB, buffered |
| Trust | the client fetches the server's ML-DSA key from `/qsetu/identity` (trust on first use) |

The same exchange in **native TLS** (OpenSSL in Node) is a different order of magnitude. Measured here (Node 24.21,
**OpenSSL 3.5.8**, loopback, 300 fresh handshakes each, no resumption, client and server in one process):

| Key exchange | CPU per full handshake (client + server) |
| --- | --- |
| X25519 | 2.358 ms |
| **X25519MLKEM768** | 3.433 ms |
| **Extra for post-quantum** | **1.075 ms for both sides, so roughly 0.5 ms on the server** |

A PQ-capable client negotiates `X25519MLKEM768` and a classical client falls back to `X25519` on the same server
(verified). **Shield Edge (phase B1) is therefore built on native TLS, not on the JS tunnel.** The B5 budget
(≤ 1.5 ms extra CPU per full handshake) looks achievable; it gets measured properly on the real proxy.

## 4. Security gaps (phase C)

| Gap | Today | Phase |
| --- | --- | --- |
| Browser security headers (CSP with nonces, HSTS, nosniff, frame-ancestors, Referrer-Policy, Permissions-Policy) | **None** (only `X-Powered-By` is off) | C1 |
| Admin second factor | Password only; 5 tries / 15 min; sessions expire after 8 h | C1: TOTP, alert on failure bursts |
| Destructive routes in production | `/api/reset-all`, `/api/reset`, `/api/keys/rotate`, `/api/policy` need only the demo session | C1: behind admin, or demo-only |
| Supply chain | All 82 direct deps use `^`/`~`; no CI; `pnpm audit`: 2 critical, 3 high (dev/build-time) | C1 |
| Behaviour-based bot / AI-agent detection | None (only per-IP limits) | C2 |
| WAF (OWASP CRS) | None | C2 (needs a maintained engine; see below) |
| Honeypots and canaries | None | C2 |
| Site modes, emergency switch, incident runbook | None | C2 |
| Dashboard, alerts, monthly report | None (the admin page lists signups) | C3 |
| SSRF guard tests | Done on `security-hardening` (11 attack-list tests) | C1: keep; add `::ffff:10.0.0.1` |

## 5. Plan and honest scope

Order: **A**, then **B**, then **C**, then **D** and **E**, committing after each phase.

Real versus stubbed is stated per item in the PR. Some things can't be completed or fully proven from a laptop,
and will say so rather than pretend:

- **ACME / Let's Encrypt** needs a public DNS name and ports 80/443 reachable from the internet. The issuance
  flow will be implemented with a maintained ACME client and tested against a local test CA where possible.
  Real Let's Encrypt issuance will be marked *not exercised here*.
- **OWASP Core Rule Set:** the brief asks for a maintained engine, not hand-written regexes. The candidate is
  Coraza (the CRS reference engine) running as a sidecar or via its WebAssembly build. If no maintained
  engine can be embedded in Node cleanly, the integration point is built and documented, and the WAF is
  labelled as not yet active.
- **ASN data, JA4 fingerprints, Googlebot reverse-DNS checks** each need data or a vantage point (the raw TLS
  ClientHello) that a Node `tls` server only partly exposes. Each one is built as far as Node allows, and the
  rest is listed.
- **The container image** (`quantumledger/shield`) is built and run locally; publishing it to a registry is a
  separate step for the founder.
- **OWASP ZAP baseline on each PR** needs a preview deploy URL; the workflow is added, and it runs once a
  preview environment exists.
