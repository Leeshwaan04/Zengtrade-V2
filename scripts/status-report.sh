#!/usr/bin/env bash
# One-screen status for founder standups (exit 1 if any P0 gate fails).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "zengtrade status — $(date -u +%Y-%m-%dT%H:%MZ)"
echo ""

prod=0 mig=0 work=0 bill=0
SITE=https://zengtrade.in ./scripts/check-production.sh >/dev/null 2>&1 && prod=1
./scripts/check-migrations.sh >/dev/null 2>&1 && mig=1
./scripts/check-worker.sh >/dev/null 2>&1 && work=1
./scripts/verify-billing.sh >/dev/null 2>&1 && bill=1

printf "Production site     %s\n" "$([[ $prod -eq 1 ]] && echo '✅' || echo '❌')"
printf "Billing functions   %s\n" "$([[ $bill -eq 1 ]] && echo '✅' || echo '❌')"
printf "Migrations (0011)   %s\n" "$([[ $mig -eq 1 ]] && echo '✅' || echo '❌')"
printf "Paper worker        %s\n" "$([[ $work -eq 1 ]] && echo '✅' || echo '❌')"

hb=$(curl -sfL 'https://ponvarxeytfcntckczbn.supabase.co/rest/v1/engine_state?key=eq._worker_heartbeat&select=updated_at' \
  -H 'apikey: sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1' 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['updated_at'][:19] if d else 'none')" 2>/dev/null || echo "none")
echo ""
echo "Worker heartbeat last: $hb UTC"

if [[ $prod -eq 1 && $bill -eq 1 && $mig -eq 1 && $work -eq 1 ]]; then
  echo ""
  echo "All P0 gates green — run ./scripts/verify-activation-path.sh then E2E signup → deploy → trades."
  exit 0
fi
echo ""
if ! curl -sfL "https://zengtrade.in/ops/p0/" 2>/dev/null | grep -q "P0 checklist"; then
  echo "Also: /ops/p0 not deployed — check GitHub Pages deploy on main."
fi
echo "Next: https://zengtrade.in/ops/p0 — migration 0011 + paper worker"
./scripts/founder-next-action.sh 2>/dev/null || true
exit 1
