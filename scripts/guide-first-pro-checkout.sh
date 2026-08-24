#!/usr/bin/env bash
# Sales/CBO: founder manual guide for first Pro MRR (worker not required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

echo "== First Pro checkout guide (Sales) — $SITE =="
echo ""

if ! ./scripts/check-sales-ready.sh; then
  echo ""
  echo "Fix sales-ready probes above before manual checkout."
  exit 1
fi

echo ""
echo "== Manual steps (incognito or test account) =="
echo ""
echo "1. Billing playbook"
echo "   → $SITE/ops/billing"
echo "   Expect: billing-ready ✓ · checkout_click funnel live"
echo ""
echo "2. Sign up with Pro intent"
echo "   → $SITE/login?mode=signup&plan=pro"
echo "   Organic alt: $SITE/login → Browse coin strategies (signup_coins UTM)"
echo "   Expect: land on $SITE/app#pricing after auth"
echo ""
echo "3. Complete Pro checkout"
echo "   → Choose Pro (\$19/mo founding) → NOWPayments invoice (test or real)"
echo "   Expect: invoice created; return URL includes ?paid=1"
echo ""
echo "4. Confirm tier flip"
echo "   → $SITE/app?paid=1 — Pro within 1–3 min after IPN"
echo "   If stuck: Supabase edge logs (nowpayments-ipn) · ./scripts/security-smoke.sh"
echo ""
echo "5. Confirm MRR in admin"
echo "   → $SITE/admin — Paying ≥ 1 · MRR > \$0 · checkout_clicks_7d incremented"
echo ""
echo "Playbook: docs/SALES_PLAYBOOK.md § First Pro checkout"
echo "Honest copy: Pro = unlimited paper today; live execution coming soon"
echo ""
echo "Growth objective (after first MRR in /admin, CBO goal complete):"
./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
