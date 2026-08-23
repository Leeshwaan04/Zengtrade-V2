#!/usr/bin/env bash
# Poll production until check-production.sh passes (use after merging to main).
set -euo pipefail
SITE="${SITE:-https://zengtrade.in}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-24}"
INTERVAL="${INTERVAL:-30}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Waiting for $SITE to pass production checks (up to $((MAX_ATTEMPTS * INTERVAL / 60)) min)…"
for ((i = 1; i <= MAX_ATTEMPTS; i++)); do
  echo "--- attempt $i/$MAX_ATTEMPTS ---"
  if SITE="$SITE" "$SCRIPT_DIR/check-production.sh"; then
    echo "Production is live."
    exit 0
  fi
  if [[ $i -lt $MAX_ATTEMPTS ]]; then
    sleep "$INTERVAL"
  fi
done
echo "Timed out — check GitHub Actions 'Deploy zengtrade to GitHub Pages' on main."
exit 1
