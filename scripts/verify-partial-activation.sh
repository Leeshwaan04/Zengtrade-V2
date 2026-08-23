#!/usr/bin/env bash
# CPO: verify signup → deploy path without paper worker (migration 0011 required).
# Use while Railway password is wrong; trades still need ./scripts/check-worker.sh.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

echo "== Partial activation (signup → deploy, no trades) =="
echo ""

./scripts/check-migrations.sh
echo ""
SITE="$SITE" ./scripts/check-activation-ready.sh
echo ""

if ./scripts/check-worker.sh >/dev/null 2>&1; then
  echo "Worker is live — run full path: ./scripts/verify-activation-path.sh"
  echo "Manual E2E: $SITE/ops/e2e"
  exit 0
fi

echo "Partial path green — manual steps 1–2: $SITE/ops/e2e"
echo "Steps 3–4 (trades) blocked until worker: $SITE/ops/worker"
echo "CLI: ./scripts/check-e2e-gates.sh"
exit 0
