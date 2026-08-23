#!/usr/bin/env bash
# Post-P0 verification — run after migration 0011 + worker are green.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== Post-P0 success runbook =="
echo ""

./scripts/verify-activation-path.sh
echo ""

echo ">> Security smoke (QA&VAPT)"
./scripts/security-smoke.sh
echo ""

echo ">> Pricing funnel truth (CBO)"
./scripts/check-pricing-truth.sh
./scripts/check-billing-ready.sh 2>/dev/null || echo "⚠️  Billing-ready probe failed"
./scripts/check-sales-ready.sh 2>/dev/null || echo "⚠️  Sales-ready probe failed"
echo ""

echo ">> Funnel CTAs + sitemap + SEO (CBO / GSC)"
./scripts/check-gsc-ready.sh
echo ""

echo ">> E2E gate probe (CPO)"
./scripts/check-e2e-gates.sh
echo ""

echo ">> QA parallel (post-P0)"
./scripts/check-qa-parallel.sh 2>/dev/null || echo "⚠️  QA parallel probe failed"
./scripts/check-founder-guides.sh 2>/dev/null || echo "⚠️  Founder guides check failed"
echo ""

echo ">> Full growth gates"
./scripts/check-growth-gates.sh
echo ""

echo ">> Plan intent routing (Sales)"
./scripts/check-plan-intent.sh
echo ""

echo "== Manual next steps =="
echo "CPO  Trades activation: signup → deploy → wait one worker cycle → closed trades in /app#forward"
echo "CPO  Full CLI gate:     ./scripts/verify-activation-path.sh"
echo "CPO  Manual E2E:        https://zengtrade.in/ops/e2e"
echo "CBO  Pro checkout:      https://zengtrade.in/ops/billing"
echo "CBO  GSC sitemap:      https://zengtrade.in/ops/gsc"
echo "QA   RLS 2-account:     ./scripts/guide-qa-rls-isolation.sh · /ops/e2e step 5"
echo ""
echo "CBO community post (draft only until E2E proven): docs/content/REDDIT_ALGOTRADING_DRAFT.md"
echo ""
echo "Log session: ./scripts/append-growth-log.sh N \"title\" --cto \"...\" --cpo \"...\" --cbo \"...\""
echo ""
echo ">> Growth goal audit"
./scripts/audit-growth-goal.sh 2>/dev/null || true
