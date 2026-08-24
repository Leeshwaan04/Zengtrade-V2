#!/usr/bin/env bash
# Post-P0 verification — run after migration 0011 + worker are green.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== Post-P0 success runbook =="
echo ""

./scripts/verify-activation-path.sh
echo ""

echo ">> Free-tier deploy cap (CPO Q9)"
ZT_QUIET_GROWTH=1 ./scripts/check-free-tier-limit.sh
echo ""

echo ">> Security smoke (QA&VAPT)"
ZT_QUIET_GROWTH=1 ./scripts/security-smoke.sh
echo ""

echo ">> Pricing funnel truth (CBO)"
ZT_QUIET_GROWTH=1 ./scripts/check-pricing-truth.sh
ZT_QUIET_GROWTH=1 ./scripts/check-billing-ready.sh 2>/dev/null || echo "⚠️  Billing-ready probe failed"
ZT_QUIET_GROWTH=1 ./scripts/check-sales-ready.sh 2>/dev/null || echo "⚠️  Sales-ready probe failed"
echo ""

echo ">> Funnel CTAs + sitemap + SEO (CBO / GSC)"
ZT_QUIET_GROWTH=1 ./scripts/check-gsc-ready.sh
echo ""

echo ">> E2E gate probe (CPO)"
ZT_QUIET_GROWTH=1 ./scripts/check-e2e-gates.sh
echo ""

echo ">> QA parallel (post-P0)"
ZT_QUIET_GROWTH=1 ./scripts/check-qa-parallel.sh 2>/dev/null || echo "⚠️  QA parallel probe failed"
ZT_QUIET_GROWTH=1 ./scripts/check-founder-guides.sh 2>/dev/null || echo "⚠️  Founder guides check failed"
echo ""

echo ">> Full growth gates"
ZT_QUIET_GROWTH=1 ./scripts/check-growth-gates.sh
echo ""

echo ">> Plan intent routing (Sales)"
ZT_QUIET_GROWTH=1 ./scripts/check-plan-intent.sh
echo ""

echo "== Manual next steps (growth goal completion) =="
echo "CTO  Loop green when this script exits 0 + heartbeat < 12m"
echo "CPO  Partial (if testing before worker): ./scripts/guide-partial-e2e.sh"
echo "       login → /dashboard (Algo Studio) deploy → post-deploy hint → /app#forward"
echo "CPO  Full trades: signup → /dashboard deploy → wait one worker cycle (~5 min) → closed trades in /app#forward"
echo "CPO  Full CLI gate:     ./scripts/verify-activation-path.sh (must exit 0)"
echo "CPO  Manual E2E:        https://zengtrade.in/ops/e2e (steps 3–4 trades · step 5 RLS)"
echo "CBO  Pro checkout:      https://zengtrade.in/ops/billing → Paying ≥ 1 in /admin"
echo "CBO  GSC sitemap:      https://zengtrade.in/ops/gsc"
echo "QA   RLS 2-account:     ./scripts/guide-qa-rls-isolation.sh · /ops/e2e step 5"
echo ""
echo "CBO community post (draft only until E2E proven): docs/content/REDDIT_ALGOTRADING_DRAFT.md"
echo ""
echo "Log session: ./scripts/append-growth-log.sh N \"title\" --cto \"...\" --cpo \"...\" --cbo \"...\""
echo ""
echo ">> Growth goal audit"
./scripts/audit-growth-goal.sh 2>/dev/null || true
