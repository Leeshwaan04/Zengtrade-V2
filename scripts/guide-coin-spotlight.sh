#!/usr/bin/env bash
# Marketing: coin spotlight post template (partial activation OK — no trade claims).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

slug="${1:-bitcoin}"
slug=$(echo "$slug" | tr '[:upper:]' '[:lower:]' | tr -d ' ')

echo "== Coin spotlight guide (Marketing) — $SITE =="
echo ""

if ! ./scripts/check-parallel-growth.sh >/dev/null 2>&1; then
  echo "WARN Parallel growth not all green — fix ./scripts/check-parallel-growth.sh first"
  echo ""
fi

if ./scripts/check-worker.sh >/dev/null 2>&1; then
  echo "Worker live — you may include forward-proof screenshots from $SITE/app#forward"
  echo ""
else
  echo "Worker offline — use paper/signup→deploy angle only (no closed-trade claims)."
  echo ""
fi

coin_url="$SITE/coins/${slug}/"
coins_hub="$SITE/coins/?utm_source=site&utm_medium=organic&utm_campaign=coin_spotlight_hub"
signup="$SITE/login?mode=signup&utm_source=site&utm_medium=organic&utm_campaign=coin_spotlight_${slug}"
studio="$SITE/dashboard?utm_source=site&utm_medium=organic&utm_campaign=coin_spotlight_deploy"

echo "Target coin page: $coin_url"
echo "Coins hub: $coins_hub"
echo "Algo Studio deploy: $studio"
echo "Verify UTMs: ./scripts/check-funnel-ctas.sh"
echo ""
echo "== Post template =="
cat <<POST
Coin of the week: ${slug^^} — regime read + paper-first angle

- What the 30-day tape looks like (honest, no hype)
- Which strategy style fits (trend vs mean-reversion) — paper only
- CTA: ${signup}
- Deploy in Algo Studio: ${studio}
- Browse all coins: ${coins_hub}

Not investment advice. Paper trading on live Binance prices.
POST
echo ""
if ./scripts/check-parallel-growth.sh >/dev/null 2>&1; then
  echo "== Growth goal (parallel green) =="
  ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
  echo ""
fi
echo "After posting: log date + slug in docs/GROWTH_DASHBOARD.md (Marketing)"
echo "Full E2E proof posts: wait for ./scripts/check-worker.sh green"
echo "Playbook: docs/MARKETING_PLAYBOOK.md § Coin spotlight template"
