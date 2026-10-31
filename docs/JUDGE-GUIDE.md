# QuantumLedger · Judge guide (3 presenters)

Post-quantum migration for banks, backed by evidence. Every number below is read from the code or from the
recorded demo run (`qshield/out/results.json`, restored by `./start.sh` from `qshield/demo-snapshot.tar.gz`).
Labels used throughout: **LIVE** (happens now, on screen), **RECORDED** (a real run, replayed from its files),
**SIMULATED** (runs on a simulator), **ASSUMPTION** (a configured planning value, not a measurement).

Start: `./start.sh` → http://localhost:3000. No sign-in needed for the demo.

---

## PART 1 · Live Scan and the problem (Presenter 1)

### Why banks need this

- **Shor's algorithm** on a large enough quantum computer breaks RSA and elliptic-curve cryptography (ECDH /
  X25519 key exchange, RSA / ECDSA signatures). Symmetric AES-256 is not the weak point.
- **Harvest now, decrypt later (HNDL):** traffic recorded today under classical key exchange can be decrypted
  later ([UK NCSC](https://www.ncsc.gov.uk/whitepaper/next-steps-preparing-for-post-quantum-cryptography)).
  Account, loan and KYC records stay sensitive for years.
- **Mosca's inequality:** exposed if **x + y > z**: x = how long data must stay secret, y = time to migrate,
  z = years until a quantum threat. Atlas computes exposure per system and scenario as
  `e = max(0, X + t/52 − (Z − start_year))`.
  - Worked example with the shipped ASSUMPTIONS (`qshield/config/assumptions.json`): a `payments` system has
    X = 7 years; plans start in 2027; the earliest scenario is Z = 2030, so z = 3. Migrated in week 4:
    y = 4/52 ≈ 0.08. x + y = 7.08 > 3, so exposed: e = 7 + 0.08 − 3 = 4.08 exposure-years in that scenario.
    (Scenarios 2030 / 2032 / 2035 with weights 0.3 / 0.4 / 0.3 are ASSUMPTIONS, not forecasts.)
- **Standards exist:** NIST published FIPS 203 (ML-KEM), FIPS 204 (ML-DSA) and FIPS 205 (SLH-DSA) in
  August 2024 ([NIST](https://www.nist.gov/news-events/news/2024/08/nist-releases-first-3-finalized-post-quantum-encryption-standards)).
  The draft [NIST IR 8547](https://csrc.nist.gov/pubs/ir/8547/ipd) proposes deprecating 112-bit RSA / ECC after
  2030 and disallowing them after 2035.
- **India context:** RBI's [IT Governance, Risk, Controls and Assurance Practices Directions, 2023](https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12562)
  (RBI/2023-24/107, in force 1 Apr 2024) and the [CERT-In 70B directions](https://www.cert-in.org.in/Directions70B.jsp)
  are the governance context. Say clearly: neither mandates post-quantum cryptography today.

### Home page walkthrough (top bar and hero)

| Control | What it does | What to say |
| --- | --- | --- |
| **Scan** (nav) | Jumps to the live scanner (`/#scan`) | "Start with any bank's website." |
| **Pipeline** (nav) | Opens the bank pipeline (`/atlas/demo`) | "Then we plan and prove the fix." |
| **Platform** | Adapters and the shared core (`/platform`) | Presenter 3 covers it. |
| **Solutions** | Sector page (fintech only) | "Built for banks and payment companies." |
| **Demos** | The four film demos (handshake, deploy, Q-Day, Proof Chain) | Optional. |
| **Docs** | Developer docs (quickstart, adapters, API) | "Everything is documented." |
| **Simple / Technical** | Switches every section's copy between plain and technical wording (remembered in the browser) | Use Technical for judges. |
| **⌘K** | Command menu: jump to any page by name | "Keyboard-first." |
| **Open pipeline** (top right) | Same as Pipeline | |
| **Scan a site** (hero button) | Scrolls to the scanner. (Earlier builds called it "Scan a live endpoint"; it is now one scanner.) | |
| **Explore the pipeline** (hero) | Opens `/atlas/demo` | |
| **Send to pipeline** (under a scan result) | Needs an Atlas **operator** sign-in and an "I own or am authorised" tick; creates a workspace "Live TLS scan, <time>" and runs the full pipeline on that host | "The scan becomes real inventory." |
| **Share result / Open result page** | Copy or open `/scan/<host>` | |

Order on the page: hero → **Live scan** → **Pipeline** preview (3D) → the story sections.

### The scanner (LIVE)

- **Input:** a public hostname or https URL. The home scanner connects on **port 443** (`lib/live/tls.ts`).
  The Atlas path behind "Send to pipeline" accepts `host[:port]` (default 443, one port per host, up to 10 hosts).
- **What it measures (one ordinary TLS handshake, offering `X25519MLKEM768:X25519:P-256:P-384`):** TLS version,
  cipher, negotiated key-exchange group (hybrid post-quantum if `X25519MLKEM768`, else classical), certificate
  key type and size, certificate signature algorithm, issuer, expiry; server location (approximate).
- **Score (packages/core `scoreFindings`):**
  `score = max(0, 100 − Σ over finding kinds ( w(severity) + 2 · min(n − 1, 5) ))`,
  weights **critical 40 · high 25 · medium 10 · low 3 · info 0**.
- **Grade:** **Quantum-ready** if score ≥ 80 and no high/critical quantum-vulnerable finding; **At risk** if
  score ≥ 50; otherwise **Critical**. The result's "How the score is computed" dropdown shows the arithmetic for
  that host.
- **How to read it:** cards (TLS version, Key exchange, Certificate, Expires) → "What a quantum computer breaks
  here" → "Recommended fixes": ML-KEM-768 (FIPS 203) via X25519MLKEM768 for key exchange; ML-DSA-65
  (FIPS 204) certificates when CAs issue them; TLS 1.3 if older.
- **Safety limits:** public hostnames only; private, loopback, link-local, CGNAT, multicast and reserved
  addresses and names like `localhost`, `.local`, `.internal` are refused; credentials in URLs refused; TLS
  connect timeout 6 s; anonymous rate limits 6/min and 30/h per client IP behind a trusted proxy
  (`QSETU_TRUST_PROXY=1`) plus 30/min and 300/h server-wide; no port scanning. If the network fails, the
  suggested hosts answer from pre-scanned real results, labelled "Cached scan … offline" (RECORDED).
- Atlas re-checks every host before its own handshake and connects to the checked address (SNI = name).

> **Handoff to Presenter 2:** "That was one website. Now watch what happens when a bank has hundreds of
> systems: the pipeline plans, tests and proves the whole migration."

---

## PART 2 · The pipeline and the math (Presenter 2)

The demo bank is **fictional** (`qshield/detect/fixtures/mock_bank`, 17 service manifests) with a real local
scan and real local TLS lab handshakes. Numbers below are from the RECORDED run in `results.json`.

| # | Stage | Input → computes → output | Formula / algorithm | Why it's credible |
| - | --- | --- | --- | --- |
| 1 | **Detect** | source tree + live/lab TLS → rules over code, configs, certificates; one handshake per probe → findings with file:line, inventory | vulnerable ⇔ family ∈ {RSA, ECC, DH, DSA}; risk weight r and shelf life X per data class (ASSUMPTIONS, e.g. payments r=10 X=7, customer_pii r=8 X=10) | Demo: 37 files, 31 findings, 29 quantum-vulnerable; every one opens to its line |
| 2 | **Proof Chain** | Detect evidence → signed ledger entry before planning | σ = ML-DSA-65.Sign(sk, entry); prev_hash = SHA-256(previous entry incl. signature) | The plan can't quietly change what was found |
| 3 | **Plan** | inventory + assumptions → weekly waves | MILP: min Σ_s p_s Σ_i r_i e_i,s (then Σ r_i t_i) s.t. each system once, Σ w_i ≤ capacity per week, dependencies first, e ≥ X + t/52 − (Z − start). Baselines FCFS (discovery order), greedy (r/w first) | Demo: **7 weeks**, weighted exposure **565.3** (QpiAI Opt local, optimal, global optimum) vs **FCFS 566.7**, **greedy 565.8**, same evaluator |
| 4 | **Tie-break** | plan → order inside each wave + patch per batch | equal score ⇒ Mosca margin x+y−z, HNDL, internet-facing, dependents, less effort, id (dependency first). Patch: key exchange → ML-KEM-768, signatures → ML-DSA-65, both → ML-KEM first | Deterministic, every decision records its key. Demo: 0 tie groups (no swap needed); a live scan of two equal hosts shows a real swap |
| 5 | **Handshakes** | lab services → real TLS 1.3 sessions | `openssl s_server`/`s_client` on 127.0.0.1 (OpenSSL 3.6.5) | Demo: 3 sessions: legacy X25519 (classical, HNDL-exposed), hybrid and pq-auth X25519MLKEM768 |
| 6 | **Gates** | waves + lab → pass/fail per wave | pq_handshake PASS ⇔ group ∈ PQ allowlist; downgrade PASS ⇔ classical-only client refused; compatibility per client; tested rollback restores the config hash. X25519MLKEM768 = ML-KEM-768 and X25519 secrets together in the TLS 1.3 key schedule | Demo: weeks 4–5 applied, 2–3 and 6–7 partially_verified, 1 not_verified_in_lab. Never "applied" without gate evidence |
| 7 | **QAOA** | one week's selection → QUBO | min −Σ r_i a_i x_i + A(Σ w_i x_i + s − C)² + B Σ x_i(1−x_j); x = (1−Z)/2 → Ising H_C; ansatz Π_l e^(−iβ_l H_M) e^(−iγ_l H_C)\|+⟩, p = 1..3; approximation ratio = best feasible sample / exact optimum | **SIMULATED** (numpy statevector, QpiAI QSV-Local) plus one **RECORDED** IBM ibm_fez run; demo ratios 1.00. QCloud rows show "not run". No quantum advantage claimed |
| 8 | **Seal** | all results → signed and re-verified chain | per entry: index, prev_hash, key fingerprint, SHA-256(payload), ML-DSA-65.Verify; RFC 6962 Merkle root | Demo: 19 entries, chain verified, root 70a94c97… |
| 9 | **Report** | results → `results.json` + offline `report.html` | schema validation (contracts/) | Every page reads only this file |

Note on hashes: the **Atlas ledger uses SHA-256** (prev_hash + RFC 6962 Merkle). The website's separate
**Proof Chain demo** (`/demo/ledger`) uses a **SHA3-256** chain `h_i = H(h_(i−1) ‖ entry_i)`. Say which one you show.

Each stage's **Details** dropdown on `/atlas/demo/<stage>` has "The math behind it", a "why this is credible"
line and that workspace's recorded number.

### /diagnostics?ws=demo controls (Q-Shield mode)

- **Run pipeline · Space:** signed out, replays the RECORDED run from `results.json` line by line, with
  `[step]` prefixes and recorded times ("Plan · recorded +1 s"). An operator on a writable workspace runs it LIVE
  over SSE; on the read-only demo an operator replays Atlas's own log of the last run.
- **Reset · R** clears the screen (not the results). **← →** step through stages. **Stage tabs** (01–09)
  select a stage; ✓ done, … running, ✗ failed.
- **Domain mode** switches to the original five-stage domain HUD; **Results pages** opens `/atlas/demo/detect`.
- **Terminal:** never blank: workspace, stage list and "press Space…", then the run log; auto-scrolls.
- **3D view:** stage discs on a curved track (green done, orange running, red failed, grey not reached); red
  blocks = systems, brighter = higher risk weight (ASSUMPTION); rows = weekly waves; diamonds = ML-KEM (cyan)
  and ML-DSA (violet), dim once chosen, bright where the lab gate passed; the column beside Seal = ledger
  entries, green once sealed and verified. Per-stage motion: scan sweep, hash links, sorting into rows, a real
  tie swap, key-exchange pulse, gate glow, QAOA shimmer, blocks locking into the chain. Hover a stage disc for
  its recorded number. The camera follows the running stage. Reduced motion and phones get a 2D view.

> **Handoff to Presenter 3:** "Everything you just saw is signed and checkable. Here's how it's built and how
> you can verify it yourself."

---

## PART 3 · Architecture, proof and why we stand out (Presenter 3)

### Architecture

```text
browser → Next.js UI (q-setu/apps/web, :3000)
            └ /atlas-api/* proxy (lib/server/atlas-proxy.ts): refuses a foreign Origin (403 bad_origin),
              forwards cookies, X-CSRF-Token and body, streams SSE, 503 atlas_down if the backend is off
                 → Q-Shield Atlas (qshield/atlas_web, Python, :8100): auth, CSRF, workspaces, runner
                      → one subprocess per step: detect → ledger → schedule → tiebreak → capture → gates
                        → qaoa → ledger ingest/verify → assemble → validate → report
                      → workspace files (out/results.json, runs/) + ML-DSA-65 signed ledger
```

- Stages come from one file, `qshield/contracts/stages.json`; modules talk only through JSON contracts.
- **Roles:** viewer < operator < admin. Signed out: the public read-only demo. Operator: Send to pipeline,
  runs. Admin: users. QpiAI platform / QCloud paid runs stay off.

### Results pages (`/atlas/demo/...`)

- **Detect:** findings with file:line and evidence; live connections. **Inventory:** systems to migrate and
  drift (config vs live handshake). **Sign findings / Seal ledger:** the Proof Chain (`ledger?section=2` / `6`),
  live verification, Merkle proof per entry. **Plan:** MILP vs FCFS vs greedy per scenario, assumptions
  labelled. **Tie-break:** order and reason per wave. **QAOA:** every qaoa.table row, non-ok rows show their
  status text. **Handshake gates:** lab sessions, compatibility, rollback, live endpoints. **Review:** a person
  approves or rejects each result; the decision is signed too.
- Top of every page: **Why banks need this now** and **About this pipeline** (closed dropdowns).

### Platform page (`/platform`)

- **Shield:** zero-code sidecar proxy in front of any server. **Web:** one script tag seals forms.
  **SDK:** ESM package for sessions, envelopes, signatures. **Edge:** ML-KEM-512 / ML-DSA-44 profile for
  devices. **Vault:** per-record keys wrapped with ML-KEM and signed with ML-DSA.
- **@qsetu/core:** algorithm registry, hybrid KEM (X25519 + ML-KEM), sessions (AES-256-GCM), envelopes ·
  ML-DSA signatures, on the open-source @noble libraries. Switching algorithms is a registry change.

### How to verify

- **Ledger:** `/atlas/demo/ledger?section=6` shows live verification; `cd qshield && python -m ledger verify`
  re-checks every ML-DSA-65 signature and hash link. Tamper with a copy and verification names the entry.
- **Tests (last runs on this branch):** qshield `pytest -q` 550 passed, 3 skipped; web unit tests (vitest) 182
  passed; Playwright e2e: all pass except four older demo tests (Demos 2–4, judge tour) that need extra
  backends. Endpoint-scan tests use recorded handshakes (`qshield/tests/fixtures/tls`), no network.
- **Labels on screen:** "(sim)", "simulated", "recorded", "Replay of the recorded run", "ASSUMPTION",
  "not_verified_in_lab", "Cached scan … offline".

### Why we stand out

1. **Scan to signed plan:** a scanner tells you RSA is there; we produce the migration plan, the patch
   order and signed proof.
2. **Provably optimal plan:** a MILP solved to a proven optimum, scored against FCFS and greedy on the same data.
3. **Evidence, not slides:** every finding has file:line or host evidence; every step is ML-DSA-65 signed.
4. **Tested on real TLS:** waves pass only on real TLS 1.3 handshake gates (hybrid X25519MLKEM768, downgrade
   refused, rollback tested).
5. **Honest by design:** assumptions, simulations and recorded runs are labelled; no quantum advantage claimed.

### How to run it

`git clone https://github.com/Yojan-ui/quantumledger.git && cd quantumledger && ./start.sh` → http://localhost:3000.
Operator (only for Send to pipeline / live runs):
`cd qshield && conda activate pqc && python -m atlas_web create-user --username demo-op --role operator`.

---

## 5-minute demo script

| Time | Who | Click | Say |
| --- | --- | --- | --- |
| 0:00 | P1 | Home | "Data recorded today can be decrypted by a future quantum computer. Banks must migrate now." |
| 0:30 | P1 | Scan → `npci.org.in` (or a judge's bank) | Read the cards: TLS version, key exchange, certificate. |
| 1:15 | P1 | "What a quantum computer breaks here" → "How the score is computed" | "Exact formula, from one handshake." |
| 1:40 | P1 → P2 | Nav **Pipeline**, then open `/diagnostics?ws=demo` | Handoff line. |
| 1:50 | P2 | Press **Space** | "Recorded run of a fictional bank: watch Detect, Proof Chain, Plan…" |
| 2:40 | P2 | Tab **03 Plan**, then `/atlas/demo/schedule` → Details | "7 weeks; MILP 565.3 vs FCFS 566.7 vs greedy 565.8." |
| 3:10 | P2 | `/atlas/demo/qaoa` | "Simulated cross-check against the exact optimum; no advantage claimed." |
| 3:30 | P2 → P3 | `/atlas/demo/ledger?section=6` | Handoff line. "19 entries, ML-DSA-65, verified." |
| 3:50 | P3 | `/platform` | Shield, Web, SDK, Edge, Vault on one core. |
| 4:20 | P3 | Back to Home → Scan result → **Send to pipeline** (signed in) | "Any host becomes real inventory." (Skip if offline.) |
| 4:40 | P3 | — | The five points; "`./start.sh` runs it all." |

## 10 likely judge questions

1. **Is the quantum part real?** QAOA runs on simulators plus one recorded IBM ibm_fez run; it cross-checks the
   classical optimum. No quantum advantage is claimed.
2. **Is the bank real?** No: a fictional bank's code, with a real scan and real lab handshakes. The live scan
   works on any real public site.
3. **Where do risk weights come from?** Configured ASSUMPTIONS per data class, shown as such, with a sensitivity test.
4. **Why MILP and not greedy?** It is solved to a proven optimum; greedy and FCFS are scored on the same data
   (565.3 vs 565.8 / 566.7 weighted exposure in the demo).
5. **What does "applied" mean?** Every lab gate passed for that wave. Scanned public hosts are never "applied".
6. **Can the ledger be faked?** Each entry is ML-DSA-65 signed and hash-linked; changing a byte fails verification.
7. **Do you scan arbitrary networks?** No: public hosts only, one handshake, no port scanning, rate limited.
8. **Why ML-KEM before ML-DSA?** Recorded key exchange is exposed today (HNDL); signatures only matter once a
   quantum computer exists at attack time.
9. **What does a bank deploy?** Shield (sidecar, no code change), Web, SDK, Edge, Vault on one core.
10. **How do I check it myself?** `./start.sh`, then `python -m ledger verify` and the test suites.

## Glossary

- **HNDL:** harvest now, decrypt later: record today, decrypt after a quantum computer exists.
- **Mosca:** x + y > z means data is exposed before migration finishes.
- **ML-KEM (FIPS 203):** post-quantum key exchange. **ML-DSA (FIPS 204):** post-quantum signatures.
- **X25519MLKEM768:** hybrid TLS group: classical X25519 plus ML-KEM-768.
- **MILP:** mixed-integer linear program; here, the optimal weekly migration plan.
- **QAOA:** a quantum optimisation algorithm, here run on simulators as a cross-check.
- **QUBO / Ising:** the binary optimisation form QAOA needs.
- **Proof Chain / ledger:** append-only, hash-linked, ML-DSA-65-signed record of every step.
- **Gate:** a per-wave TLS test that must pass before a wave counts as applied.
- **Atlas:** the Python pipeline backend (`qshield/`).
