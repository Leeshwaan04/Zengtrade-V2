#!/usr/bin/env bash
# Fast growth summary when worker is blocked — skips slow validate-database-credentials re-probe.
# Callers may override any GROWTH_* var before invoking.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export GROWTH_WORK="${GROWTH_WORK:-0}"
export GROWTH_DB_AUTH="${GROWTH_DB_AUTH:-0}"
export GROWTH_PARTIAL="${GROWTH_PARTIAL:-1}"
export GROWTH_MIG="${GROWTH_MIG:-1}"
export GROWTH_GSC="${GROWTH_GSC:-1}"
export GROWTH_SALES="${GROWTH_SALES:-1}"
export GROWTH_BILL="${GROWTH_BILL:-1}"

exec "$ROOT/scripts/print-growth-goal-summary.sh"
