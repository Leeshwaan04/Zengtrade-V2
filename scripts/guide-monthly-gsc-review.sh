#!/usr/bin/env bash
# SEO: founder monthly GSC review steps (no API required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

echo "== Monthly GSC review guide (SEO) — $SITE =="
echo ""

if ! env SITE="$SITE" ./scripts/check-gsc-ready.sh >/dev/null 2>&1; then
  echo "WARN GSC-ready probes not all green — run ./scripts/check-gsc-ready.sh first"
  echo ""
fi

echo "Run on the first Monday of each month (after property verified)."
echo ""
echo "1. Open Search Console → property $SITE"
echo "2. Performance → last 28 days → export top 20 queries + pages"
echo "3. Note impressions/clicks for /, /pricing/, /how-it-works/, top 3 coin pages"
echo "4. Indexing → confirm sitemap $SITE/sitemap.xml — 0 critical errors"
echo "5. URL inspection → request indexing for new coin pages or major copy changes"
echo "6. Log findings in docs/GROWTH_DASHBOARD.md under SEO for that month"
echo ""
echo "Automated preflight:"
echo "  ./scripts/check-gsc-ready.sh"
echo "  ./scripts/check-sitemap.sh"
echo "  ./scripts/check-funnel-ctas.sh"
echo ""
echo "Founder setup (once): ./scripts/guide-gsc-founder.sh · $SITE/ops/gsc"
echo "Playbook: docs/SEO_PLAYBOOK.md § Monthly GSC review"
echo ""
echo "Growth objective:"
GROWTH_GSC=1 ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
