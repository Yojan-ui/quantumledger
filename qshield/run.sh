#!/usr/bin/env bash
# Start the Q-Shield Atlas backend on http://127.0.0.1:8100/ (macOS / Linux). 8100, not 8000: AetherPool's
# backend owns 8000. Extra arguments go to atlas_web (q-setu's `pnpm dev:atlas` passes --no-browser).
cd "$(dirname "$0")"
eval "$(conda shell.bash hook)"
conda activate pqc
[ -f .env.sh ] && source .env.sh
exec python -m atlas_web --port 8100 "$@"
