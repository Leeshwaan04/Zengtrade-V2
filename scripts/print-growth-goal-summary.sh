#!/usr/bin/env bash
# Print growth goal audit summary (CTO/CPO/CBO) without re-running probes when caller sets GROWTH_* env vars.
# Usage: GROWTH_PROD=1 GROWTH_WORK=0 ... ./scripts/print-growth-goal-summary.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

probe_or_env() {
  local var="$1" script="$2"
  local v="${!var:-}"
  if [[ -n "$v" ]]; then
    echo "$v"
    return
  fi
  if [[ -n "$script" ]] && "$ROOT/scripts/$script" >/dev/null 2>&1; then
    echo 1
  else
    echo 0
  fi
}

prod=$(probe_or_env GROWTH_PROD check-production.sh)
mig=$(probe_or_env GROWTH_MIG check-migrations.sh)
work=$(probe_or_env GROWTH_WORK check-worker.sh)
gsc=$(probe_or_env GROWTH_GSC check-gsc-ready.sh)
sales=$(probe_or_env GROWTH_SALES check-sales-ready.sh)

oauth="${GROWTH_OAUTH:-}"
if [[ -z "$oauth" ]]; then
  if curl -sfL "$SITE/js/auth.js" 2>/dev/null | grep -q establishSession; then oauth=1; else oauth=0; fi
fi

bill="${GROWTH_BILL:-}"
if [[ -z "$bill" ]]; then
  if ./scripts/verify-billing.sh >/dev/null 2>&1; then bill=1; else bill=0; fi
fi

db_auth="${GROWTH_DB_AUTH:-}"
if [[ -z "$db_auth" ]]; then
  if [[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" ]]; then
    if ./scripts/validate-database-credentials.sh >/dev/null 2>&1; then db_auth=1; else db_auth=0; fi
  else
    db_auth=1
  fi
fi

partial="${GROWTH_PARTIAL:-}"
if [[ -z "$partial" ]]; then
  if [[ "$work" -eq 0 && "$mig" -eq 1 ]]; then
    if ./scripts/verify-activation-path.sh --partial >/dev/null 2>&1; then partial=1; else partial=0; fi
  elif [[ "$work" -eq 1 ]]; then
    partial=1
  else
    partial=0
  fi
fi

cto_fail=0 cpo_fail=0
[[ $prod -eq 1 && $oauth -eq 1 && $bill -eq 1 && $mig -eq 1 && $work -eq 1 && $db_auth -eq 1 ]] || cto_fail=1

if [[ $work -eq 0 ]]; then
  cpo_fail=1
else
  full=0
  if ./scripts/verify-activation-path.sh >/dev/null 2>&1; then full=1; fi
  [[ $full -eq 1 ]] || cpo_fail=1
fi

if [[ $cto_fail -eq 1 ]]; then
  echo "CTO blocked — ./scripts/run-p0-if-ready.sh · https://zengtrade.in/ops/worker"
fi
if [[ $cpo_fail -eq 1 && $work -eq 0 ]]; then
  echo "CPO partial OK — full trades after worker: https://zengtrade.in/ops/e2e"
fi
if [[ $gsc -eq 1 && $sales -eq 1 ]]; then
  echo "CBO founder — GSC: ./scripts/guide-gsc-founder.sh · MRR: ./scripts/guide-first-pro-checkout.sh · /admin"
elif [[ $gsc -eq 0 || $sales -eq 0 ]]; then
  echo "CBO blocked — fix ./scripts/check-gsc-ready.sh or ./scripts/check-sales-ready.sh"
fi

if [[ $cto_fail -eq 0 && $cpo_fail -eq 0 && $gsc -eq 1 && $sales -eq 1 ]]; then
  echo "All growth goal requirements green (verify first Pro MRR in /admin)."
fi
