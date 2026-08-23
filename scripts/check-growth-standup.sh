#!/usr/bin/env bash
# Daily autopilot standup — P0 status + parallel CBO/CPO work (for GROWTH_DASHBOARD logs).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== zengtrade growth standup — $(date -u +%Y-%m-%dT%H:%MZ) =="
echo ""
./scripts/status-report.sh || true
echo ""
./scripts/snapshot-growth-metrics.sh 2>/dev/null || true
if ! ./scripts/check-worker.sh >/dev/null 2>&1; then
  ./scripts/check-parallel-growth.sh 2>/dev/null | tail -8 || true
fi
if [[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" ]]; then
  ./scripts/sync-ops-gates.py 2>/dev/null || true
fi
