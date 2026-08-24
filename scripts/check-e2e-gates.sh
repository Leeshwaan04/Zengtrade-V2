#!/usr/bin/env bash
# CPO: probe whether manual E2E at /ops/e2e can start (migration 0011 + worker).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mig=0 work=0
./scripts/check-migrations.sh >/dev/null 2>&1 && mig=1
./scripts/check-worker.sh >/dev/null 2>&1 && work=1

echo "== E2E activation gates =="
echo ""
printf "Migration 0011   %s\n" "$([[ $mig -eq 1 ]] && echo '✅' || echo '❌')"
printf "Paper worker     %s\n" "$([[ $work -eq 1 ]] && echo '✅' || echo '❌')"
echo ""

if [[ $mig -eq 1 && $work -eq 1 ]]; then
  echo "E2E ready — run manual steps at https://zengtrade.in/ops/e2e"
  echo "Then: ./scripts/verify-activation-path.sh"
  exit 0
fi

if [[ $mig -eq 1 && $work -eq 0 ]]; then
  echo "Partial E2E — test signup → deploy UI (trades need worker):"
  echo "  https://zengtrade.in/ops/e2e"
  echo ""
  if ./scripts/verify-activation-path.sh --partial >/dev/null 2>&1; then
    echo "Partial activation ✅ — run manual steps 1–2 at /ops/e2e"
    echo "  CLI guide: ./scripts/guide-partial-e2e.sh"
    echo "  Path: /login → /dashboard deploy → /app#forward (evidence; trades need worker)"
  elif SITE=https://zengtrade.in ./scripts/check-activation-ready.sh >/dev/null 2>&1; then
    echo "Activation UI ✅ — signup → deploy path ready for manual test"
  else
    echo "Activation UI ❌ — run ./scripts/check-activation-ready.sh"
  fi
  echo ""
  if [[ -z "${ZT_QUIET_GROWTH:-}" ]]; then
    echo "Growth objective:"
    ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
    echo ""
  fi
  echo "P0 unblock: ./scripts/guide-worker-recovery.sh · https://zengtrade.in/ops/worker"
  exit 1
fi

echo "Apply migration 0011 first: https://zengtrade.in/ops/migrate"
exit 1
