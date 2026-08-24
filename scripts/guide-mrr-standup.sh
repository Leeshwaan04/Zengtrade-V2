#!/usr/bin/env bash
# Sales: weekly MRR + funnel standup from /admin (founder manual).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

echo "== Weekly MRR standup (Sales) — $SITE =="
echo ""

if ! ./scripts/check-sales-ready.sh >/dev/null 2>&1; then
  echo "WARN Sales-ready probes not green — run ./scripts/check-sales-ready.sh first"
  echo ""
fi

echo "Open $SITE/admin (login required) and record:"
echo ""
echo "| Tile / metric | Action |"
echo "|---------------|--------|"
echo "| MRR | Note USD total; target \$290 @ 30d |"
echo "| Paying | Count Pro/Elite; first checkout goal ≥ 1 (Google OAuth on ?plan=pro OK) |"
echo "| checkout_clicks_7d | Path suffixes: free_limit_upgrade, deploy_success_pro, forward_empty_pro |"
echo "| plan_intents_7d | From ?plan=pro|elite signups |"
echo "| deploy_success_7d | Activated users ready to upgrade (partial OK while worker down) |"
echo "| signups (total) | Day-over-day from dashboard |"
echo ""
echo "Worker offline: deploy_success can grow without closed trades — see $SITE/ops/e2e"
echo "If MRR = \$0 after checkout test:"
echo "  → ./scripts/guide-first-pro-checkout.sh"
echo "  → Supabase edge logs: nowpayments-ipn"
echo "  → ./scripts/security-smoke.sh (unsigned IPN must 401)"
echo ""
echo "Log date + paying count in docs/GROWTH_DASHBOARD.md (Sales section)."
echo "Playbook: docs/SALES_PLAYBOOK.md § Weekly sales standup"
echo ""
echo "Growth objective:"
./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
