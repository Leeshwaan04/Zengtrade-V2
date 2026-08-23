#!/usr/bin/env bash
# Verify all founder guide scripts exist and are executable.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
fail=0

ok() { echo "OK   $1"; }
bad() { echo "FAIL $1"; fail=1; }

echo "== check-founder-guides =="
echo ""

guides=(
  guide-founder-parallel.sh
  guide-partial-e2e.sh
  guide-free-tier-test.sh
  guide-gsc-founder.sh
  guide-first-pro-checkout.sh
  guide-linkedin-bip.sh
  guide-monthly-gsc-review.sh
  guide-qa-rls-isolation.sh
  guide-coin-spotlight.sh
)

for g in "${guides[@]}"; do
  path="scripts/$g"
  if [[ -f "$path" && -x "$path" ]]; then
    ok "$g"
  elif [[ -f "$path" ]]; then
    bad "$g (not executable)"
  else
    bad "$g (missing)"
  fi
done

echo ""
if [[ $fail -ne 0 ]]; then
  echo "check-founder-guides failed — chmod +x scripts/guide-*.sh"
  exit 1
fi
echo "check-founder-guides passed (${#guides[@]} scripts)."
