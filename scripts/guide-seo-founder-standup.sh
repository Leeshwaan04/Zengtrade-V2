#!/usr/bin/env bash
# SEO: founder combined standup for GSC + organic (worker not required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

echo "== SEO founder standup (GSC + organic) — $SITE =="
echo ""

echo ">> Automated probes"
fail=0
if env SITE="$SITE" ./scripts/check-gsc-ready.sh >/dev/null 2>&1; then
  echo "OK   GSC-ready (sitemap + SEO content + funnel CTAs)"
else
  echo "FAIL GSC-ready — ./scripts/check-gsc-ready.sh"
  fail=1
fi
if env SITE="$SITE" ./scripts/check-sitemap.sh >/dev/null 2>&1; then
  echo "OK   Sitemap (7 coin pSEO URLs)"
else
  echo "FAIL Sitemap — ./scripts/check-sitemap.sh"
  fail=1
fi
echo ""

if [[ $fail -ne 0 ]]; then
  echo "Fix probe failures above."
  exit 1
fi

echo "== Manual playbook (recommended order) =="
echo ""
echo "A. GSC setup — ~30 min (one-time)"
echo "   → ./scripts/guide-gsc-founder.sh"
echo "   → $SITE/ops/gsc"
echo "   Verify property · submit $SITE/sitemap.xml · request indexing"
echo "   Log completion in docs/GROWTH_DASHBOARD.md (CBO/SEO)"
echo ""
echo "B. Monthly review — ~15 min"
echo "   → ./scripts/guide-monthly-gsc-review.sh"
echo "   → docs/SEO_PLAYBOOK.md"
echo ""
echo "C. Partial proof posts (no closed-trade claims)"
echo "   → ./scripts/guide-marketing-founder-standup.sh"
echo "   → docs/content/WEEKLY_PROOF.md § Partial proof"
echo ""
echo "CBO combined (GSC + MRR): ./scripts/guide-cbo-founder-standup.sh"
echo "All roles: ./scripts/guide-founder-growth-standup.sh"
echo "Playbook: docs/GSC_SETUP.md · docs/SEO_PLAYBOOK.md"
echo ""
echo "Growth objective:"
GROWTH_GSC=1 ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
