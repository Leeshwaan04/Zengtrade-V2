#!/usr/bin/env bash
# Print founder guide index + verify all guide scripts exist.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

./scripts/check-founder-guides.sh
echo ""
echo "Full index: docs/GUIDE_INDEX.md"
echo "Playbooks:  ./scripts/guide-founder-parallel.sh"
echo "Probes:     ./scripts/check-founder-parallel-ready.sh"
