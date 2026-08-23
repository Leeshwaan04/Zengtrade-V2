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

parallel="—"
if [[ $work -eq 0 ]] && ./scripts/check-parallel-growth.sh >/dev/null 2>&1; then
  parallel="✅"
elif [[ $work -eq 0 ]]; then
  parallel="❌"
fi

worker_txt=$([[ $work -eq 1 ]] && echo "✅" || echo "❌")

echo "### Status (\`./scripts/check-growth-standup.sh\` @ ${tshort})"
echo "- worker ${worker_txt} · migration 0011 $([[ $mig -eq 1 ]] && echo '✅' || echo '❌') · parallel growth ${parallel}"
if [[ -n "$shipped" ]]; then
  echo "- ${shipped}"
fi
echo ""
