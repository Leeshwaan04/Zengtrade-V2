#!/usr/bin/env bash
# Poll until migration 0011 + worker are green, then run activation verify.
# Usage: ./scripts/wait-for-p0.sh [interval_seconds]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
INTERVAL="${1:-60}"

echo "Waiting for P0 gates (migration 0011 + worker heartbeat)…"
echo "Founder checklist: https://zengtrade.in/ops/p0"
echo ""

while true; do
  if SITE=https://zengtrade.in ./scripts/check-production.sh >/dev/null 2>&1 \
    && ./scripts/verify-billing.sh >/dev/null 2>&1 \
    && ./scripts/check-migrations.sh >/dev/null 2>&1 \
    && ./scripts/check-worker.sh >/dev/null 2>&1; then
    echo ""
    echo "P0 gates green at $(date -u +%Y-%m-%dT%H:%MZ)"
    break
  fi
  ./scripts/status-report.sh 2>/dev/null || true
  echo "Retry in ${INTERVAL}s…"
  sleep "$INTERVAL"
done

echo ""
exec ./scripts/verify-activation-path.sh
