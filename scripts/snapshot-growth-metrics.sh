#!/usr/bin/env bash
# Print growth metrics snapshot for GROWTH_DASHBOARD (probes + worker; /admin for signups/MRR).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

ts=$(date -u +%Y-%m-%dT%H:%MZ)
work=0 mig=0 act=0 bill=0 gsc=0 funnel=0
./scripts/check-worker.sh >/dev/null 2>&1 && work=1
./scripts/check-migrations.sh >/dev/null 2>&1 && mig=1
SITE="$SITE" ./scripts/check-activation-ready.sh >/dev/null 2>&1 && act=1
SITE="$SITE" ./scripts/check-billing-ready.sh >/dev/null 2>&1 && bill=1
SITE="$SITE" ./scripts/check-gsc-ready.sh >/dev/null 2>&1 && gsc=1
SITE="$SITE" ./scripts/check-funnel-ctas.sh >/dev/null 2>&1 && funnel=1
if [[ $act -eq 0 ]]; then
  sleep 2
  SITE="$SITE" ./scripts/check-activation-ready.sh >/dev/null 2>&1 && act=1
fi

hb=$(curl -sfL 'https://ponvarxeytfcntckczbn.supabase.co/rest/v1/engine_state?key=eq._worker_heartbeat&select=updated_at' \
  -H 'apikey: sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1' 2>/dev/null \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['updated_at'][:19] if d else 'none')" 2>/dev/null || echo "none")

worker_txt=$([[ $work -eq 1 ]] && echo "Live" || echo "Offline")
[[ $work -eq 0 && "$hb" != "none" ]] && worker_txt="Offline (last $hb UTC)"

echo "== Growth metrics snapshot — $ts =="
echo ""
echo "| Metric | Today (probes) |"
echo "|--------|----------------|"
echo "| Worker status | $worker_txt |"
echo "| Migration 0011 | $([[ $mig -eq 1 ]] && echo '✅' || echo '❌') |"
echo "| Activation UI | $([[ $act -eq 1 ]] && echo '✅' || echo '❌') |"
echo "| Billing-ready | $([[ $bill -eq 1 ]] && echo '✅' || echo '❌') |"
echo "| GSC-ready | $([[ $gsc -eq 1 ]] && echo '✅' || echo '❌') |"
echo "| Funnel CTAs (7 coins) | $([[ $funnel -eq 1 ]] && echo '✅' || echo '❌') |"
echo "| Signups / deployers / MRR | /admin (login required) |"
gates=$((work + mig + act + bill + gsc + funnel))
echo "| Growth gates (excl. worker) | $gates/6 |"
echo ""
if [[ $work -eq 0 ]]; then
  ./scripts/founder-next-action.sh 2>/dev/null | sed 's/^/  /' || true
fi
