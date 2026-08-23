#!/usr/bin/env bash
# Print a GROWTH_DASHBOARD session status block from live probes (agent appends to docs/GROWTH_DASHBOARD.md).
# Usage: ./scripts/log-growth-session.sh [session-N] [optional one-line shipped summary]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

label="${1:-session}"
shipped="${2:-}"

tshort="$(date -u +%H:%M)Z"
work=0 mig=0
./scripts/check-worker.sh >/dev/null 2>&1 && work=1
./scripts/check-migrations.sh >/dev/null 2>&1 && mig=1

worker_txt=$([[ $work -eq 1 ]] && echo "✅" || echo "❌")

parallel="—"
sales="—"
qa="—"
partial="—"
if [[ $work -eq 0 ]]; then
  parallel="❌"
  sales="❌"
  qa="❌"
  partial="❌"
  for _ in 1 2 3; do
    [[ "$parallel" == "❌" ]] && ./scripts/check-parallel-growth.sh >/dev/null 2>&1 && parallel="✅"
    [[ "$sales" == "❌" ]] && ./scripts/check-sales-ready.sh >/dev/null 2>&1 && sales="✅"
    [[ "$qa" == "❌" ]] && ./scripts/check-qa-parallel.sh >/dev/null 2>&1 && qa="✅"
    [[ "$partial" == "❌" && $mig -eq 1 ]] && ./scripts/verify-activation-path.sh --partial >/dev/null 2>&1 && partial="✅"
    [[ "$parallel" == "✅" && "$sales" == "✅" ]] && break
    sleep 2
  done
fi

echo "### Status (\`./scripts/check-growth-standup.sh\` @ ${tshort})"
if [[ $work -eq 0 && $mig -eq 1 ]]; then
  echo "- worker ${worker_txt} · migration 0011 $([[ $mig -eq 1 ]] && echo '✅' || echo '❌') · partial activation ${partial} · parallel growth ${parallel} · sales-ready ${sales}${qa:+ · qa parallel ${qa}}"
else
  echo "- worker ${worker_txt} · migration 0011 $([[ $mig -eq 1 ]] && echo '✅' || echo '❌') · parallel growth ${parallel} · sales-ready ${sales}${qa:+ · qa parallel ${qa}}"
fi
if [[ -n "$shipped" ]]; then
  echo "- ${shipped}"
fi
echo ""
