#!/usr/bin/env bash
# One command after `git clone`: installs what's missing, builds the site once, starts everything and opens
# http://localhost:3000 in your browser. Ctrl-C stops it all.
#
#   ./start.sh            start (build only if there is no build yet)
#   ./start.sh --rebuild  rebuild the website first
#
# No sign-in is needed for the demo (scan, pipeline, diagnostics replay); operators only for live runs.
# Starts: website :3000 (Next.js production build), Q-Shield Atlas pipeline backend :8100, and the demo
# backends (legacy bank :4000, Shield proxies :8443 / :8080). Logs go to .logs/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
LOGS="$ROOT/.logs"
mkdir -p "$LOGS"
say() { printf '\033[1m[start]\033[0m %s\n' "$*"; }
die() { printf '\033[31m[start] %s\033[0m\n' "$*" >&2; exit 1; }

# ── checks ──────────────────────────────────────────────────────────────────────────────────────
command -v node >/dev/null || die "Node.js 20+ is required: https://nodejs.org"
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || die "Node.js 20+ is required (found $(node -v))."
busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
for port in 3000 8100 4000 8443 8080; do
  busy "$port" && die "Port $port is already in use. Stop the other server first (two servers sharing one database break the Proof Chain)."
done
if ! command -v pnpm >/dev/null; then
  say "enabling pnpm through corepack"
  corepack enable >/dev/null 2>&1 || npm install -g pnpm@10 >/dev/null
fi

# ── website ─────────────────────────────────────────────────────────────────────────────────────
cd "$ROOT/q-setu"
if [ ! -d node_modules ]; then
  say "installing website dependencies (first run, a few minutes)"
  pnpm install --frozen-lockfile >"$LOGS/install.log" 2>&1 || die "pnpm install failed: see .logs/install.log"
fi
if [ "${1:-}" = "--rebuild" ] || [ ! -f apps/web/.next/BUILD_ID ]; then
  say "building the website (first run, a few minutes)"
  pnpm build >"$LOGS/build.log" 2>&1 || die "build failed: see .logs/build.log"
fi

pids=()
cleanup() { say "stopping"; kill "${pids[@]}" 2>/dev/null || true; wait 2>/dev/null || true; }
trap cleanup EXIT INT TERM

# ── Q-Shield Atlas (pipeline backend) ───────────────────────────────────────────────────────────
# Prefers the conda env `pqc` (Python 3.12 + OpenSSL 3.6.5 with ML-KEM / ML-DSA); otherwise a local venv.
ATLAS_PY=""
if command -v conda >/dev/null && conda env list 2>/dev/null | grep -qE '^pqc\s'; then
  ATLAS_PY="$(conda run -n pqc python -c 'import sys; print(sys.executable)' 2>/dev/null || true)"
fi
if [ -z "$ATLAS_PY" ]; then
  PY="$(command -v python3.12 || command -v python3 || true)"
  if [ -n "$PY" ]; then
    if [ ! -x "$ROOT/qshield/.venv/bin/python" ]; then
      say "creating qshield/.venv for the pipeline backend"
      "$PY" -m venv "$ROOT/qshield/.venv" && "$ROOT/qshield/.venv/bin/pip" install -q -r "$ROOT/qshield/requirements.txt" \
        >"$LOGS/atlas-install.log" 2>&1 || say "pipeline backend install failed (see .logs/atlas-install.log); the site still runs"
    fi
    [ -x "$ROOT/qshield/.venv/bin/python" ] && ATLAS_PY="$ROOT/qshield/.venv/bin/python"
  fi
fi
# The public demo workspace reads qshield/out/results.json: build it once if a fresh clone has none (local only:
# no QpiAI platform or QCloud jobs; needs OpenSSL >= 3.5, which the conda env provides).
if [ -n "$ATLAS_PY" ] && [ ! -f "$ROOT/qshield/out/results.json" ]; then
  say "building the demo snapshot (qshield/run_demo.sh, local only, a few minutes)"
  (cd "$ROOT/qshield" && PYTHON="$ATLAS_PY" PATH="$(dirname "$ATLAS_PY"):$PATH" ./run_demo.sh --no-open) \
    >"$LOGS/run_demo.log" 2>&1 || say "demo snapshot failed (see .logs/run_demo.log); pipeline pages will say 'not yet run'"
fi
if [ -n "$ATLAS_PY" ]; then
  (cd "$ROOT/qshield" && { [ -f .env.sh ] && source .env.sh; true; } && exec "$ATLAS_PY" -m atlas_web --port 8100 --no-browser) \
    >"$LOGS/atlas.log" 2>&1 & pids+=($!)
  say "pipeline backend → http://127.0.0.1:8100"
else
  say "no Python 3.12 found: the pipeline pages will say the backend is not running (the rest of the site works)"
fi

# ── demo backends and the website ───────────────────────────────────────────────────────────────
pnpm --filter @qsetu/legacy-bank dev >"$LOGS/legacy-bank.log" 2>&1 & pids+=($!)
pnpm dev:shield-server >"$LOGS/shield-server.log" 2>&1 & pids+=($!)
pnpm dev:shield-client >"$LOGS/shield-client.log" 2>&1 & pids+=($!)
pnpm --filter @qsetu/web start >"$LOGS/web.log" 2>&1 & pids+=($!)

URL="http://localhost:3000"
for _ in $(seq 1 60); do
  curl -fsS -o /dev/null "$URL" 2>/dev/null && break
  sleep 1
done
curl -fsS -o /dev/null "$URL" 2>/dev/null || die "the website did not start: see .logs/web.log"
say "QuantumLedger is running → $URL   (Ctrl-C to stop)"
if command -v open >/dev/null; then open "$URL"; elif command -v xdg-open >/dev/null; then xdg-open "$URL" >/dev/null 2>&1; fi
wait
