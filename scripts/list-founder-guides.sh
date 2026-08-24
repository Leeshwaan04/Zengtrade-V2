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
echo "Probes:     ./scripts/check-founder-parallel-ready.sh"
echo "Audit:      ./scripts/audit-growth-goal.sh · ./scripts/check-growth-goal.sh"
echo "Summary:    ./scripts/print-growth-goal-summary.sh"
echo "Partial:    ./scripts/verify-activation-path.sh --partial"
