#!/usr/bin/env bash
# Print the single highest-priority founder action (for standups / issue #4).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mig=0 work=0
./scripts/check-migrations.sh >/dev/null 2>&1 && mig=1
./scripts/check-worker.sh >/dev/null 2>&1 && work=1

if [[ $mig -eq 0 ]]; then
  echo "NEXT: Apply migration 0011 → https://zengtrade.in/ops/migrate"
  exit 1
fi
if [[ $work -eq 0 ]]; then
  echo "NEXT: Deploy paper worker → https://zengtrade.in/ops/worker"
  exit 1
fi

echo "NEXT: P0 green — run ./scripts/wait-for-p0.sh then E2E https://zengtrade.in/ops/e2e"
exit 0
