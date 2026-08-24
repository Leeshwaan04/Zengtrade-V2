#!/usr/bin/env bash
# Map autopilot growth objective to live probes (CTO / CPO / CBO).
# Exit 0 only when production loop + full activation + first MRR evidence are all green.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

echo "== zengtrade growth goal audit — $(date -u +%Y-%m-%dT%H:%MZ) =="
echo ""

cto_fail=0 cpo_fail=0 cbo_fail=0

line() {
  local role="$1" label="$2" ok="$3" note="${4:-}"
  printf "  %-28s %s" "$label" "$([[ $ok -eq 1 ]] && echo '✅' || echo '❌')"
  [[ -n "$note" ]] && printf "  (%s)" "$note"
  echo ""
}

echo "### CTO — production loop (auth + worker)"
prod=0 oauth=0 bill=0 mig=0 work=0 db_auth=0
SITE="$SITE" ./scripts/check-production.sh >/dev/null 2>&1 && prod=1
curl -sfL "$SITE/js/auth.js" 2>/dev/null | grep -q establishSession && oauth=1
./scripts/verify-billing.sh >/dev/null 2>&1 && bill=1
./scripts/check-migrations.sh >/dev/null 2>&1 && mig=1
./scripts/check-worker.sh >/dev/null 2>&1 && work=1
if [[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" ]]; then
  ./scripts/probe-database-auth.sh >/dev/null 2>&1 && db_auth=1
else
  db_auth=1
fi
line CTO "Production /app + billing" "$prod"
line CTO "Google OAuth (establishSession)" "$oauth"
line CTO "Migration 0011" "$mig"
line CTO "Paper worker heartbeat" "$work"
if [[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" ]]; then
  line CTO "DATABASE_URL auth" "$db_auth" "/ops/worker"
fi
[[ $prod -eq 1 && $oauth -eq 1 && $bill -eq 1 && $mig -eq 1 && $work -eq 1 && $db_auth -eq 1 ]] || cto_fail=1
echo ""

echo "### CPO — signup → deploy → trades"
partial=0 full=0
if [[ $work -eq 0 && $mig -eq 1 ]]; then
  ./scripts/verify-activation-path.sh --partial >/dev/null 2>&1 && partial=1
  line CPO "Partial activation (signup→deploy)" "$partial" "verify-activation-path --partial"
  line CPO "Full activation (trades)" "0" "blocked — needs worker"
  cpo_fail=1
elif [[ $work -eq 1 ]]; then
  partial=1
  if ./scripts/verify-activation-path.sh >/dev/null 2>&1; then
    full=1
  fi
  line CPO "Partial activation (signup→deploy)" "1" "worker live"
  line CPO "Full activation (trades gate)" "$full" "verify-activation-path.sh"
  [[ $full -eq 1 ]] || cpo_fail=1
else
  line CPO "Partial activation" "0" "migration 0011 required"
  line CPO "Full activation (trades)" "0" "migration + worker"
  cpo_fail=1
fi
echo ""

echo "### CBO — organic + first Pro MRR"
gsc=0 sales=0
SITE="$SITE" ./scripts/check-gsc-ready.sh >/dev/null 2>&1 && gsc=1
./scripts/check-sales-ready.sh >/dev/null 2>&1 && sales=1
line CBO "GSC-ready (organic infrastructure)" "$gsc" "/ops/gsc"
line CBO "Sales-ready (Pro checkout path)" "$sales" "/ops/billing"
line CBO "First Pro MRR (live)" "0" "founder: /admin Paying ≥ 1 · MRR > \$0"
[[ $gsc -eq 1 && $sales -eq 1 ]] || cbo_fail=1
echo ""

echo "### Summary"
if [[ $cto_fail -eq 0 && $cpo_fail -eq 0 && $cbo_fail -eq 0 ]]; then
  echo "All growth goal requirements green."
  exit 0
fi

GROWTH_PROD=$prod GROWTH_MIG=$mig GROWTH_WORK=$work GROWTH_GSC=$gsc GROWTH_SALES=$sales \
  GROWTH_DB_AUTH=$db_auth GROWTH_PARTIAL=$partial GROWTH_BILL=$bill GROWTH_OAUTH=$oauth \
  ./scripts/print-growth-goal-summary-fast.sh
exit 1
