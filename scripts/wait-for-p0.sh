#!/usr/bin/env bash
# Poll until migration 0011 + worker are green, then run activation verify.
# Usage: ./scripts/wait-for-p0.sh [interval_seconds]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
INTERVAL="${1:-60}"

echo "Waiting for P0 gates (migration 0011 + worker heartbeat)…"
echo "Founder checklist: https://zengtrade.in/ops/p0"
if ! curl -sfL "https://zengtrade.in/ops/p0/" 2>/dev/null | grep -q "P0 checklist"; then
  echo "Note: /ops/p0 not on production yet — push main and wait for GitHub Pages deploy."
fi
echo "Tip: add DATABASE_PASSWORD (or DATABASE_URL) on Railway / Cloud Agent / GitHub Secrets — auto-runs apply-p0 when credentials work."
echo "      Preflight: ./scripts/validate-database-credentials.sh"
echo "      Recovery: docs/WORKER_RECOVERY.md"
echo "      Parallel work: ./scripts/guide-founder-parallel.sh"
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
  # Picks up DATABASE_URL from Cloud Agent env or Railway service variables
  if ./scripts/run-p0-if-ready.sh 2>/dev/null; then
    exit 0
  fi
  ./scripts/status-report.sh 2>/dev/null || true
  echo "Retry in ${INTERVAL}s…"
  sleep "$INTERVAL"
done

echo ""
exec ./scripts/post-p0-success.sh
