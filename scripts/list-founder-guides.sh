#!/usr/bin/env bash
# Print founder guide index + verify all guide scripts exist.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

./scripts/check-founder-guides.sh
echo ""
echo "Full index: docs/GUIDE_INDEX.md"
echo "Parallel:   docs/FOUNDER_PARALLEL.md"
echo "Playbooks:  ./scripts/guide-founder-parallel.sh"
echo "CBO standup: ./scripts/guide-cbo-founder-standup.sh"
echo "CPO standup: ./scripts/guide-cpo-founder-standup.sh"
echo "Growth standup: ./scripts/guide-founder-growth-standup.sh"
echo "QA standup:   ./scripts/guide-qa-founder-standup.sh"
echo "CTO standup:  ./scripts/guide-cto-founder-standup.sh"
echo "Sales standup: ./scripts/guide-sales-founder-standup.sh"
echo "Post-P0:    ./scripts/post-p0-success.sh · ./scripts/guide-qa-rls-isolation.sh"
echo "Marketing:  ./scripts/guide-linkedin-bip.sh · ./scripts/guide-coin-spotlight.sh [slug]"
echo "Probes:     ./scripts/check-founder-parallel-ready.sh"
echo "Audit:      ./scripts/audit-growth-goal.sh · ./scripts/check-growth-goal.sh"
echo "Summary:    ./scripts/print-growth-goal-summary.sh"
echo "Partial:    ./scripts/verify-activation-path.sh --partial"
