#!/usr/bin/env bash
# Print growth metrics snapshot for GROWTH_DASHBOARD (probes + worker; /admin for signups/MRR).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

ts=$(date -u +%Y-%m-%dT%H:%MZ)
work=0 mig=0 act=0 bill=0 gsc=0 funnel=0 prod=0 sales=0 partial=0 db_auth_ok=0
./scripts/check-worker.sh >/dev/null 2>&1 && work=1
./scripts/check-migrations.sh >/dev/null 2>&1 && mig=1
SITE="$SITE" ./scripts/check-production.sh >/dev/null 2>&1 && prod=1
SITE="$SITE" ./scripts/check-activation-ready.sh >/dev/null 2>&1 && act=1
SITE="$SITE" ./scripts/check-billing-ready.sh >/dev/null 2>&1 && bill=1
SITE="$SITE" ./scripts/check-gsc-ready.sh >/dev/null 2>&1 && gsc=1
SITE="$SITE" ./scripts/check-funnel-ctas.sh >/dev/null 2>&1 && funnel=1
for _ in 1 2; do
  [[ $act -eq 1 && $bill -eq 1 && $gsc -eq 1 && $funnel -eq 1 ]] && break
  sleep 2
  [[ $act -eq 0 ]] && SITE="$SITE" ./scripts/check-activation-ready.sh >/dev/null 2>&1 && act=1
  [[ $bill -eq 0 ]] && SITE="$SITE" ./scripts/check-billing-ready.sh >/dev/null 2>&1 && bill=1
  [[ $gsc -eq 0 ]] && SITE="$SITE" ./scripts/check-gsc-ready.sh >/dev/null 2>&1 && gsc=1
  [[ $funnel -eq 0 ]] && SITE="$SITE" ./scripts/check-funnel-ctas.sh >/dev/null 2>&1 && funnel=1
done

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
partial=0
if [[ $work -eq 0 && $mig -eq 1 ]]; then
  ./scripts/verify-activation-path.sh --partial >/dev/null 2>&1 && partial=1
fi
if [[ $work -eq 0 ]]; then
  echo "| Partial activation (signup→deploy) | $([[ $partial -eq 1 ]] && echo '✅' || echo '❌') verify-activation-path --partial |"
fi
echo "| Activation UI | $([[ $act -eq 1 ]] && echo '✅' || echo '❌') |"
echo "| Billing-ready | $([[ $bill -eq 1 ]] && echo '✅' || echo '❌') |"
sales=0 qa=0
for _ in 1 2 3; do
  [[ $sales -eq 0 ]] && ./scripts/check-sales-ready.sh >/dev/null 2>&1 && sales=1
  [[ $qa -eq 0 ]] && ./scripts/check-qa-parallel.sh >/dev/null 2>&1 && qa=1
  [[ $sales -eq 1 && $qa -eq 1 ]] && break
  sleep 2
done
echo "| Sales-ready | $([[ $sales -eq 1 ]] && echo '✅' || echo '❌') |"
echo "| QA parallel | $([[ $qa -eq 1 ]] && echo '✅' || echo '❌') |"
echo "| GSC-ready | $([[ $gsc -eq 1 ]] && echo '✅' || echo '❌') |"
echo "| Funnel CTAs (7 coins) | $([[ $funnel -eq 1 ]] && echo '✅' || echo '❌') |"
echo "| Signups / deployers / MRR | /admin (login required) |"
if [[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" ]]; then
  if ./scripts/validate-database-credentials.sh >/dev/null 2>&1; then
    db_auth_ok=1
    echo "| DATABASE_URL auth | ✅ |"
  else
    echo "| DATABASE_URL auth | ❌ Railway password — /ops/worker |"
  fi
else
  db_auth_ok=1
fi
cto_goal=$([[ $prod -eq 1 && $mig -eq 1 && $work -eq 1 && $db_auth_ok -eq 1 ]] && echo '✅ auth+worker+DB' || echo '❌ /ops/worker')
if [[ $work -eq 1 ]]; then
  cpo_goal="✅ signup → trades"
elif [[ $partial -eq 1 ]]; then
  cpo_goal="partial ✅ (trades need worker)"
else
  cpo_goal="❌"
fi
cbo_goal=$([[ $gsc -eq 1 && $sales -eq 1 ]] && echo '✅ GSC+sales-ready · MRR /admin' || echo '❌')
echo "| Growth: CTO loop | $cto_goal |"
echo "| Growth: CPO trades | $cpo_goal |"
echo "| Growth: CBO infra | $cbo_goal |"
gates=$((mig + act + bill + gsc + funnel))
echo "| Growth gates (excl. worker) | $gates/5 |"
echo ""
echo "Growth goal summary:"
GROWTH_PROD=$prod GROWTH_MIG=$mig GROWTH_WORK=$work GROWTH_GSC=$gsc GROWTH_SALES=$sales \
  GROWTH_DB_AUTH=$db_auth_ok GROWTH_PARTIAL=$partial GROWTH_BILL=$bill \
  ./scripts/print-growth-goal-summary.sh 2>/dev/null | sed 's/^/  /' || true
echo ""
if [[ $work -eq 0 ]]; then
  ./scripts/founder-next-action.sh 2>/dev/null | sed 's/^/  /' || true
fi
