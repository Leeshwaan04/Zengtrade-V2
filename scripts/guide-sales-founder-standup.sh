#!/usr/bin/env bash
# Sales: founder combined standup for first Pro MRR (worker not required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

echo "== Sales founder standup (first Pro MRR) — $SITE =="
echo ""

if ! env ZT_QUIET_GROWTH=1 ./scripts/check-sales-ready.sh >/dev/null 2>&1; then
  echo "FAIL Sales-ready probes — run ./scripts/check-sales-ready.sh"
  exit 1
fi
echo "OK   Sales-ready (billing + plan intent + pricing truth)"
echo ""

echo "== Manual playbook (recommended order) =="
echo ""
echo "A. Optional trust path — ~5 min (before checkout)"
echo "   → $SITE/dashboard deploy → View evidence → $SITE/app#forward"
echo "   → ./scripts/guide-partial-e2e.sh"
echo ""
echo "B. First Pro checkout — ~15 min"
echo "   → ./scripts/guide-first-pro-checkout.sh"
echo "   → $SITE/ops/billing"
echo "   → $SITE/login?mode=signup&plan=pro (Google OAuth OK)"
echo "   Complete NOWPayments invoice → return to $SITE/app?paid=1"
echo ""
echo "C. Confirm MRR in /admin"
echo "   → Paying ≥ 1 · MRR > \$0 · checkout_clicks_7d incremented"
echo "   → Tier shows Pro on $SITE/app (1–3 min after IPN)"
echo ""
echo "D. Weekly review"
echo "   → ./scripts/guide-mrr-standup.sh"
echo "   Log date + paying count in docs/GROWTH_DASHBOARD.md (Sales)"
echo ""
echo "CBO combined (GSC + MRR): ./scripts/guide-cbo-founder-standup.sh"
echo "All roles: ./scripts/guide-founder-growth-standup.sh"
echo "Playbook: docs/SALES_PLAYBOOK.md"
echo ""
echo "Growth objective:"
GROWTH_SALES=1 ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
