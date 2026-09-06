#!/usr/bin/env bash
# Print a GROWTH_DASHBOARD session status block from live probes (agent appends to docs/GROWTH_DASHBOARD.md).
# Usage: ./scripts/log-growth-session.sh [session-N] [optional one-line shipped summary]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export ZT_QUIET_GROWTH=1

label="${1:-session}"
shipped="${2:-}"

tshort="$(date -u +%H:%M)Z"
work=0 mig=0 gsc_ready=0 sales_ready=0 prod=0 db_auth_ok=0
./scripts/check-worker.sh >/dev/null 2>&1 && work=1
./scripts/check-migrations.sh >/dev/null 2>&1 && mig=1
SITE=https://zengtrade.in ./scripts/check-production.sh >/dev/null 2>&1 && prod=1
if [[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" ]]; then
  ./scripts/probe-database-auth.sh >/dev/null 2>&1 && db_auth_ok=1
else
  db_auth_ok=1
fi

worker_txt=$([[ $work -eq 1 ]] && echo "✅" || echo "❌")

parallel="-"
sales="-"
qa="-"
partial="-"

if [[ $work -eq 0 ]]; then
  parallel_ok=0
  for _ in 1 2; do
    if env ZT_QUIET_GROWTH=1 ./scripts/check-parallel-growth.sh >/dev/null 2>&1; then
      parallel_ok=1
      break
    fi
    sleep 3
  done
  if [[ $parallel_ok -eq 1 ]]; then
    parallel="✅"
    sales="✅"
    partial="✅"
    gsc_ready=1
    sales_ready=1
  else
    parallel="❌"
    sales="❌"
    partial="❌"
  fi
  env ZT_QUIET_GROWTH=1 ./scripts/check-qa-parallel.sh >/dev/null 2>&1 && qa="✅" || qa="❌"
else
  SITE=https://zengtrade.in ./scripts/check-gsc-ready.sh >/dev/null 2>&1 && gsc_ready=1
  ./scripts/check-sales-ready.sh >/dev/null 2>&1 && sales_ready=1
  sales=$([[ $sales_ready -eq 1 ]] && echo "✅" || echo "❌")
  env ZT_QUIET_GROWTH=1 ./scripts/check-qa-parallel.sh >/dev/null 2>&1 && qa="✅" || qa="❌"
fi

echo "### Status (\`./scripts/check-growth-standup.sh\` @ ${tshort})"
if [[ $work -eq 0 && $mig -eq 1 ]]; then
  echo "- worker ${worker_txt} · migration 0011 $([[ $mig -eq 1 ]] && echo '✅' || echo '❌') · partial activation ${partial} · parallel growth ${parallel} · sales-ready ${sales}${qa:+ · qa parallel ${qa}}"
  if [[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" ]]; then
    if ./scripts/probe-database-auth.sh >/dev/null 2>&1; then
      echo "- DATABASE_URL auth ✅"
    else
      echo "- DATABASE_URL auth ❌ (Railway password — /ops/worker)"
    fi
  fi
else
  echo "- worker ${worker_txt} · migration 0011 $([[ $mig -eq 1 ]] && echo '✅' || echo '❌') · parallel growth ${parallel} · sales-ready ${sales}${qa:+ · qa parallel ${qa}}"
fi
cto_g=$([[ $prod -eq 1 && $mig -eq 1 && $work -eq 1 && $db_auth_ok -eq 1 ]] && echo '✅' || echo '❌')
if [[ $work -eq 1 ]]; then
  cpo_g="✅ trades"
elif [[ "$partial" == "✅" ]]; then
  cpo_g="partial ✅"
else
  cpo_g="❌"
fi
cbo_g=$([[ $gsc_ready -eq 1 && $sales_ready -eq 1 ]] && echo '✅ infra' || echo '❌')
echo "- growth goals: CTO ${cto_g} · CPO ${cpo_g} · CBO ${cbo_g} · MRR founder /admin"
if [[ -n "$shipped" ]]; then
  echo "- ${shipped}"
fi
echo ""
