#!/usr/bin/env bash
# CPO: founder manual guide for partial E2E (signup → deploy, no trades).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

echo "== Partial E2E guide (CPO) — $SITE =="
echo ""

if ! ./scripts/verify-activation-path.sh --partial; then
  echo ""
  echo "Fix probes above before manual test."
  exit 1
fi

echo ""
echo "== Manual steps (incognito) =="
echo ""
echo "1. Signup"
echo "   → $SITE/login?mode=signup"
echo "   Expect: land on $SITE/dashboard after Google/email auth"
echo ""
echo "2. Deploy paper strategy"
echo "   → $SITE/dashboard → Algo Studio → Library → Deploy (e.g. Trend Follower)"
echo "   Expect: deploy success toast; no upgrade block on first deploy"
echo ""
echo "3. Trades (blocked until worker)"
echo "   → Requires fresh worker heartbeat: $SITE/ops/worker"
echo "   After P0: $SITE/app#forward within ~5–15 min"
echo ""
echo "Full checklist: $SITE/ops/e2e"
echo "Recovery: docs/WORKER_RECOVERY.md"
