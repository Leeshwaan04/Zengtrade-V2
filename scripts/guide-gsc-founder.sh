#!/usr/bin/env bash
# CBO/SEO: founder manual guide for GSC verify + sitemap (worker not required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

echo "== GSC founder guide (CBO) — $SITE =="
echo ""

if ! env SITE="$SITE" ./scripts/check-gsc-ready.sh; then
  echo ""
  echo "Fix GSC-ready probes above before Search Console setup."
  exit 1
fi

echo ""
echo "== Manual steps (founder) =="
echo ""
echo "1. Add property"
echo "   → https://search.google.com/search-console"
echo "   → URL prefix: $SITE"
echo "   → Verify via DNS TXT (recommended) or HTML file"
echo ""
echo "2. Submit sitemap"
echo "   → Indexing → Sitemaps → $SITE/sitemap.xml"
echo ""
echo "3. Request indexing (priority URLs)"
echo "   → $SITE/"
echo "   → $SITE/pricing/"
echo "   → $SITE/how-it-works/"
echo "   → $SITE/coins/ · $SITE/coins/bitcoin/ · ethereum · solana"
echo "   → $SITE/login?mode=signup"
echo ""
echo "4. Baseline screenshot"
echo "   → Performance tab (28d) — save for week-over-week compare"
echo ""
echo "5. Log completion"
echo "   → Note date in docs/GROWTH_DASHBOARD.md (CBO section)"
echo "   → Founder page: $SITE/ops/gsc"
echo ""
echo "Playbook: docs/GSC_SETUP.md · Monthly review: docs/SEO_PLAYBOOK.md"
echo "Do not post forward P&L until worker live: ./scripts/check-worker.sh"
echo ""
echo "Parallel (no worker): first Pro MRR — $SITE/ops/billing · ./scripts/guide-first-pro-checkout.sh"
echo ""
echo "Growth objective:"
./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
