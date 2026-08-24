#!/usr/bin/env bash
# Alias for audit-growth-goal.sh (CTO/CPO/CBO objective probes).
exec "$(cd "$(dirname "$0")/.." && pwd)/scripts/audit-growth-goal.sh" "$@"
