#!/usr/bin/env bash
# Build (if needed) and run engine :9001, bridge :8000 and UI :5173 together.
# Ctrl-C stops all three.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -x "$ROOT/engine/build/aether_engine" ]; then
  echo "[dev] building engine (first run fetches liboqs 0.14.0)…"
  cmake -S "$ROOT/engine" -B "$ROOT/engine/build" -DCMAKE_BUILD_TYPE=Release ${OPENSSL_ROOT_DIR:+-DOPENSSL_ROOT_DIR="$OPENSSL_ROOT_DIR"}
  cmake --build "$ROOT/engine/build" -j
fi
if [ ! -d "$ROOT/backend/.venv" ]; then
  python3 -m venv "$ROOT/backend/.venv"
  "$ROOT/backend/.venv/bin/pip" install -q -r "$ROOT/backend/requirements.txt"
fi
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  (cd "$ROOT/frontend" && npm install --no-audit --no-fund)
fi

pids=()
cleanup() { kill "${pids[@]}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

"$ROOT/engine/build/aether_engine" & pids+=($!)
(cd "$ROOT/backend" && exec .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --log-level warning) & pids+=($!)
(cd "$ROOT/frontend" && exec npx vite --port 5173) & pids+=($!)
wait
