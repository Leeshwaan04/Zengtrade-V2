#!/usr/bin/env bash
# One-screen status for founder standups (exit 1 if any P0 gate fails).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "zengtrade status — $(date -u +%Y-%m-%dT%H:%MZ)"
echo ""

prod=0 mig=0 work=0 bill=0 gsc=0 act=0 sales=0 qa=0 ops_p0=0
prod_out=$(SITE=https://zengtrade.in ./scripts/check-production.sh 2>&1) && prod=1 || true
echo "$prod_out" | grep -q 'OK   ops-p0' && ops_p0=1
./scripts/check-migrations.sh >/dev/null 2>&1 && mig=1
./scripts/check-worker.sh >/dev/null 2>&1 && work=1
./scripts/check-billing-ready.sh >/dev/null 2>&1 && bill=1
./scripts/check-sales-ready.sh >/dev/null 2>&1 && sales=1
./scripts/check-qa-parallel.sh >/dev/null 2>&1 && qa=1
SITE=https://zengtrade.in ./scripts/check-gsc-ready.sh >/dev/null 2>&1 && gsc=1
SITE=https://zengtrade.in ./scripts/check-activation-ready.sh >/dev/null 2>&1 && act=1

printf "Production site     %s\n" "$([[ $prod -eq 1 ]] && echo '✅' || echo '❌')"
printf "Billing-ready       %s\n" "$([[ $bill -eq 1 ]] && echo '✅' || echo '❌')"
printf "Sales-ready         %s\n" "$([[ $sales -eq 1 ]] && echo '✅' || echo '❌')"
printf "QA parallel         %s\n" "$([[ $qa -eq 1 ]] && echo '✅' || echo '❌')"
printf "Migrations (0011)   %s\n" "$([[ $mig -eq 1 ]] && echo '✅' || echo '❌')"
printf "Paper worker        %s\n" "$([[ $work -eq 1 ]] && echo '✅' || echo '❌')"
printf "GSC-ready           %s\n" "$([[ $gsc -eq 1 ]] && echo '✅' || echo '❌')"
printf "Activation UI       %s\n" "$([[ $act -eq 1 ]] && echo '✅' || echo '❌')"
if [[ $work -eq 0 && $mig -eq 1 ]]; then
  partial=0
  ./scripts/verify-activation-path.sh --partial >/dev/null 2>&1 && partial=1
  printf "Partial activation  %s\n" "$([[ $partial -eq 1 ]] && echo '✅ (signup → deploy)' || echo '❌')"
fi

hb=$(curl -sfL 'https://ponvarxeytfcntckczbn.supabase.co/rest/v1/engine_state?key=eq._worker_heartbeat&select=updated_at' \
  -H 'apikey: sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1' 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['updated_at'][:19] if d else 'none')" 2>/dev/null || echo "none")
echo ""
echo "Worker heartbeat last: $hb UTC"

if [[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" ]]; then
  ./scripts/check-railway-deploy.sh 2>/dev/null || true
  if ./scripts/validate-database-credentials.sh >/dev/null 2>&1; then
    echo "DATABASE_URL auth     ✅"
  else
    echo "DATABASE_URL auth     ❌ (Railway password invalid — /ops/worker)"
  fi
fi

if [[ $prod -eq 1 && $bill -eq 1 && $mig -eq 1 && $work -eq 1 ]]; then
  echo ""
  echo "All P0 gates green — run ./scripts/post-p0-success.sh then E2E signup → deploy → trades."
  exit 0
fi
echo ""
if [[ $ops_p0 -eq 0 ]]; then
  echo "Also: /ops/p0 not deployed — check GitHub Pages deploy on main."
fi
if [[ $mig -eq 1 && $work -eq 0 ]]; then
  echo "Next: https://zengtrade.in/ops/worker — paper worker only (add DATABASE_URL on Railway)"
  if ./scripts/check-parallel-growth.sh >/dev/null 2>&1; then
    echo "Parallel growth: 5/5 gates green (excl. worker) — ./scripts/guide-founder-parallel.sh"
  fi
elif [[ $mig -eq 0 ]]; then
  echo "Next: https://zengtrade.in/ops/p0 — migration 0011 + paper worker"
else
  echo "Next: https://zengtrade.in/ops/p0"
fi
./scripts/founder-next-action.sh 2>/dev/null || true
exit 1
