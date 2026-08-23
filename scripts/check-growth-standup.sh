#!/usr/bin/env bash
# Daily autopilot standup — P0 status + parallel CBO/CPO work (for GROWTH_DASHBOARD logs).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== zengtrade growth standup — $(date -u +%Y-%m-%dT%H:%MZ) =="
echo ""
./scripts/status-report.sh || true
