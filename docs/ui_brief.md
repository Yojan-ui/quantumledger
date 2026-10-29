# QuantumLedger Lab: UI brief (stage 1, discovery)

Scope agreed on 2026-10-29: a new black-and-white, 3D, plain-ES-module UI for the **QuantumLedger
platform (`q-setu/`)**, built **alongside** the existing Next.js/React pages (they stay untouched).
AetherPool (`engine/`, `backend/`, `frontend/`) is out of scope. Rules: `UI_QUALITY.md` at the repo root.
Reference architecture studied (not copied): `Yojan-ui/q-shield-atlas` `atlas_web/`.

## 0. What the backend really is (discovery, all measured)

`q-setu` is a pnpm monorepo: `apps/web` (Next.js 15, React 19) whose **route handlers are the backend**,
over `packages/core` (`@qsetu/core`: scanner, CBOM, hybrid KEM, registry). State lives in SQLite under
`QSETU_DATA_DIR` (or Postgres via `DATABASE_URL`); the Proof Chain is an ML-DSA-65-signed, SHA3-256
hash-chained ledger. OpenAPI: `GET /api/docs` (27 paths). Live event bus: `GET /api/stream` (SSE).

Run log for this discovery (`pnpm install --frozen-lockfile`, then `next dev` on 127.0.0.1 with
`NEXT_PUBLIC_OFFLINE=1` and a temp `QSETU_DATA_DIR`; target commit `9284459`; 2026-10-29T03:54Z):

| step | result |
|---|---|
| `pnpm test` (vitest) | **128 passed** in 19 files (Proof Chain on SQLite and Postgres included) |
| `POST /api/scan` sample `java-tls` (application.properties, 662 B, sha256 `e16f1811…854c2a`) | 200 in 5.6 ms · score **0** · Critical · 4 critical / 3 high / 2 medium · 9 findings · CBOM 8 components |
| `POST /api/scan` sample `openssl-cert` (upi-gw.crt, 1805 B, sha256 `0cfa3512…bcbb77`) | 200 in 4.6 ms · score **56** · At risk · 3 critical · 3 findings · CBOM 3 components |
| `POST /api/scan` sample `node-sign` (psp-signer.js, 641 B, sha256 `04876289…d298a2`) | 200 in 4.4 ms · score **23** · Critical · 2 critical / 1 high / 1 medium · 4 findings · CBOM 4 components |
| `POST /api/plan` (java-tls findings, data lifetime 10 y) | 200 in 14.6 ms · 6 steps · horizon 2035, 9 years left · markdown variant 26 lines |
| `POST /api/scan/url` `ecc256.badssl.com`, `cachedOnly` | 200 · cached real scan · score 23 · Critical · TLSv1.2, prime256v1, ECDHE-ECDSA, no hybrid PQ |
| `POST /api/ledger/verify` | OK, 51 entries checked |
| `POST /api/ledger/tamper {id:42}` then verify | **fails at #42**, reason `payload-modified`; restore → OK, same head hash |
| error paths | 256 KB + 1 → 400 `Input too large (max 256 KB)`; bad JSON → 400 `Body must be JSON`; lifetime 500 → 400 `Too big: expected number to be <=100` |

Facts that shape the UI:
- **Scans are synchronous and fast (~5 ms).** There is no "run", job, progress or cancel concept today.
- **The existing error envelope is `{"error":{"code","message","issues":[{path,message}]}}`**, not `fields`.
- **Anchoring needs a TLS transcript.** `POST /api/proof/anchor` requires `transcriptSha3`, which a
  pasted-code scan does not have; only URL scans carry a TLS probe.
- Only 8 hosts have pre-cached real scans (offline mode); live URL probes reach the user's host (rate-limited).
- No auth on scanner routes (admin routes only, behind `ADMIN_PASSWORD`).
- Available locally, no new installs needed: three `0.180.0` (`apps/web/node_modules`), Playwright `1.64.0`
  with Chromium, node 24. OFL fonts (Inter Tight 600/700, JetBrains Mono 400/500) can be reused from the reference.

## a) Data contract

### Inputs (every one feeds an existing backend function)

| input | UI control | type / validation (server is the source of truth) | backend function |
|---|---|---|---|
| pasted source | textarea + filename field | UTF-8 text, ≤ 256 KB (`ScanBody.text`); filename ≤ 120 chars | `scan(text, filename)` (`@qsetu/core`) |
| uploaded files | drag-and-drop / file picker | each ≤ 256 KB, text only (UTF-8, no NUL bytes), ≤ 20 files, ≤ 2 MB total *(new limits, proposed)* | `scan()` once per file |
| host or URL | single-line field | 1–2048 chars, parsed by `hostFromInput`; live probe or the 8 cached real scans | `scanHost()` / `cachedScan()` |
| data lifetime | number field | 0–100 years, default 10 (`PlanBody.dataLifetimeYears`) | `buildPlan()` |
| hybrid PQ already deployed | toggle | boolean, optional (`PlanBody.hybridPq`) | `buildPlan()` |
| sample data | "Sample data" buttons | one of `SCAN_SAMPLES` (`java-tls`, `openssl-cert`, `node-sign`), sent through the same run path and labelled **Sample data** | `scan()` |

### Outputs (exact JSON shapes, from the code and the run above)

```jsonc
// scan(): ScanResult
{ "score": 0-100, "grade": "Quantum-ready" | "At risk" | "Critical",
  "summary": { "critical": n, "high": n, "medium": n, "low": n, "info": n },
  "findings": [ { "ruleId", "line", "column", "match", "algorithm", "primitive", "severity",
                  "quantumVulnerable", "quantumSafe", "parameter"?, "why", "replacement" } ],
  "cbom": { "bomFormat": "CycloneDX", "specVersion": "1.6", "serialNumber", "version", "metadata", "components": [...] } }
// buildPlan(): Plan
{ "steps": [ { "id", "priority", "title", "action", "why", "effort", "fixer", "resolves" } ],
  "assumptions": { "dataLifetimeYears", "horizonYear", "yearsLeft" }, "markdown": "..." }
// scanHost()/cachedScan(): ScanRecord = ScanResult + { "probe": { "host","address","protocol","group","cipher",
//   "certKey","certSigAlg","issuer","validTo","hybridPq","report" }, "plan", "plain", "geo", "scannedAt", "cached"? }
// Proof Chain entry: { "id","kind","subject","payload","at","prev","hash","sig","alg","keyId" }
// ledger verify: { "ok", "checked", "ms", "head", "broken"?: { "id", "reason", "detail" } }
```

New run result (proposed; assembled only from the outputs above, no derived scores):

```jsonc
{ "runId", "workspace", "status": "queued"|"running"|"done"|"failed"|"cancelled",
  "startedAt", "finishedAt", "durationMs",
  "version": { "app": "@qsetu/web x.y.z", "core": "@qsetu/core x.y.z", "commit": "<git sha>" },
  "inputs": [ { "name", "source": "paste"|"upload"|"url"|"sample", "bytes", "lines", "sha256" } ],
  "inputSha256": "<sha256 over the sorted input sha256s>",
  "stages": [ { "name": "validate"|"scan"|"plan"|"sign"|"verify", "status", "ms" } ],
  "files": [ { "name", "sha256", ...ScanResult } ],          // one per input, no aggregate score invented
  "url": ScanRecord | null,
  "plan": Plan,                                              // buildPlan over all findings (≤ 2000)
  "ledger": { "entryId", "hash", "verify": { ...ledger verify } } | null,
  "log": [ { "t", "stage", "message" } ] }
```

## b) API plan (new routes under `/api/lab/*`, added as Next route handlers next to the existing ones)

Error envelope on every new route: `{"error":{"code","message","fields":{"<path>":"<message>"}}}`.

| method | path | purpose | notes |
|---|---|---|---|
| GET | `/api/lab/health` | version, commit, offline flag, limits | |
| POST | `/api/lab/workspaces` | create a workspace | id in the URL; dir under `QSETU_DATA_DIR/lab/<ws>` |
| GET | `/api/lab/samples` | `SCAN_SAMPLES`, labelled Sample data | |
| POST | `/api/lab/validate` | parse preview without running: per input bytes, lines, sha256, rejects | same validators as the run |
| POST | `/api/lab/uploads` | multipart upload → staged input ids | size/type caps, path-traversal-safe names |
| POST | `/api/lab/runs` | start a run → `202 {runId}` | **409** if the workspace already has an active run |
| GET | `/api/lab/runs/:id` | run state (status, stages, progress) | |
| GET | `/api/lab/runs/:id/events` | SSE: `stage`, `progress`, `log`, `file`, `result`, `error`, `cancelled` | only real events |
| GET | `/api/lab/runs/:id/result` | final result JSON (shape above) | |
| GET | `/api/lab/runs/:id/scene` | precomputed scene.json (positions, heights) with ETag | |
| GET | `/api/lab/runs/:id/export?format=json\|csv\|cbom\|plan\|report` | downloads; `report` = printable HTML | |
| POST | `/api/lab/runs/:id/cancel` | cancel between units; aborts a live probe | |
| GET/POST | existing `/api/ledger`, `/api/ledger/verify` | Proof Chain read and verify | reused, unchanged |

Run stages (all real): **validate** → **scan** (one unit per input; one event per finished file) →
**plan** → **sign** (Proof Chain append, see D3) → **verify** (ledger verify) → done.
Progress = completed units / total units (units = inputs + 3), so the % is a count, never a timer.

## c) Routes (6, one primary action each; all deep-linkable, SPA fallback for `/lab/*`)

| route | screen | primary action |
|---|---|---|
| `/lab` | Landing: the Proof Chain as it stands (entry count, head hash, last verify) and this workspace's last run | **New scan** |
| `/lab/input` | Input: paste, drop files, host/URL, data lifetime, Sample data; parse preview | **Run scan** |
| `/lab/runs/:id` | Run (live): stages, per-file results arriving, log, aria-live announcements | **Cancel run** (becomes **Open results** when done) |
| `/lab/runs/:id/results` | Results: per-file score/grade, severity counts, findings matrix | **Inspect findings** (opens the most severe) |
| `/lab/runs/:id/findings/:file/:n` | Detail: one finding: match, line, algorithm, why, replacement, CBOM component | **Next finding** (j/k) |
| `/lab/runs/:id/evidence` | Evidence/Export: migration plan, CBOM, ledger entry + verify, run metadata | **Download report** |

## d) State → visual (every 3D element has a data field; anything else is deleted)

| scene element | driven by (real field) |
|---|---|
| Proof Chain column (landing, evidence): one slab per entry | `GET /api/ledger` entries; slab brightness = `ok` of the last verify; a broken entry (`broken.id`) is inverted (white solid) |
| Chain light sweep | a `POST /api/ledger/verify` call in flight → `uProgress` = `checked / count` when it returns |
| Staged inputs (input): one plate per input | plate depth ∝ `bytes`; plate lines ∝ `lines`; a rejected input renders as wireframe |
| Source lattice (run, results): one column of cells per file, one cell per source line | x = file index, z = line number (`lines` from validate) |
| Finding pillars | position = (`file`, `line`); height ∝ `SEVERITY_WEIGHT[severity]` (40/25/10/3/0); solid if `quantumVulnerable`, wireframe if `quantumSafe` |
| Run sweep (wireframe → solid) | per-file `file` SSE event: that file's column morphs (`uMorph`) when its ScanResult arrives |
| Score monolith per file | height ∝ `score` (0–100) |
| Plan steps (evidence) | one tick per `steps[]`, order = `priority` |
| Camera focus (detail) | flies to the clicked finding's pillar (`file`, `line`) |
| Idle motion | breathing ≤ 1.5 % and parallax ≤ 2° are the only non-data motion (both specified in UI_QUALITY.md; off with reduced motion) |

## Open decisions (need your OK before stage 2)

- **D1 Serving.** Static UI files in `q-setu/apps/web/public/lab/` (plain ES modules, no bundler), new
  route handlers in `app/api/lab/*`, SPA fallback via a new `app/lab/[[...path]]/route.ts` that returns
  `public/lab/index.html`. It runs on the existing Next server; no new framework.
- **D2 Error envelope.** New `/api/lab/*` routes return `fields`; existing routes keep `issues`
  (changing them is a behaviour change). OK, or should `fields` also be added to existing routes?
- **D3 Signing a run.** The existing anchor needs a TLS transcript hash that code scans don't have.
  Proposal: the `sign` stage appends one ML-DSA-signed `lab-run` entry
  (`{runId, inputSha256, resultSha256, files, findings}`) through the existing `ledger.append`. URL-only runs
  could use the real anchor. Or skip signing for code scans.
- **D4 One semantic signal?** Critical grade / quantum-vulnerable / broken chain can be shown in pure
  monochrome (inverted block, solid vs wireframe, labels). Proposal: monochrome only, no colour token.
- **D5 Live probes.** URL scans from the lab probe the user's host for real (existing, rate-limited).
  Default the lab to `cachedOnly` unless the user ticks "probe live"?
- **D6 Tests and tooling.** JS unit tests with `node --test` in `public/lab/jstests/`; endpoint tests in the
  existing vitest suite; `route_check` as `tools/route_check.mjs` on the already-installed Node Playwright
  (your spec says `.py`, but Python Playwright isn't installed and would be a new dependency).
- **D7 Workspaces.** Server-side workspace directory per id (inputs, runs, results), one active run per
  workspace (409 on a second). No auth.
- **D8 Assets.** Vendor three `0.180.0` (`three.module.min.js` + `three.core.min.js`) and the OFL fonts into
  `public/lab/vendor/` with a SHA-256 manifest checked by a test.
- **D9 Your message was cut off at "2. Backend API + SSE +".** Please resend stages 2+ (or confirm I should
  follow the stage list implied by the API plan above).
