#!/usr/bin/env bash
# Agent entry point — run each autopilot turn on main when pursuing P0.
# Applies migration 0011 + deploys worker when DATABASE_URL is available (env or Railway).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export ZT_QUIET_GROWTH="${ZT_QUIET_GROWTH:-1}"

mig=0 work=0
./scripts/check-migrations.sh >/dev/null 2>&1 && mig=1
./scripts/check-worker.sh >/dev/null 2>&1 && work=1

if [[ $mig -eq 1 && $work -eq 1 ]]; then
  echo "P0 already green — running post-P0 runbook"
  exec ./scripts/post-p0-success.sh
fi

DATABASE_URL="${DATABASE_URL:-${SUPABASE_DATABASE_URL:-}}"
if [[ -n "${DATABASE_URL:-}" ]]; then
  sanitized=$(./scripts/sanitize-database-url.sh "$DATABASE_URL")
  if [[ "$sanitized" != "$DATABASE_URL" ]]; then
    echo "WARN  DATABASE_URL had [brackets] around password — auto-stripping"
    DATABASE_URL="$sanitized"
    export DATABASE_URL
  fi
  if ! DATABASE_URL="$DATABASE_URL" ./scripts/test-database-url.sh >/dev/null 2>&1; then
    echo "WARN  DATABASE_URL in env failed auth — trying DATABASE_PASSWORD / Railway"
    DATABASE_URL=""
    unset DATABASE_URL 2>/dev/null || true
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  if resolved=$(./scripts/resolve-database-url.sh 2>/dev/null); then
    DATABASE_URL="$resolved"
    export DATABASE_URL
    echo "OK   DATABASE_URL resolved (password secret or Railway)"
  fi
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  sanitized=$(./scripts/sanitize-database-url.sh "$DATABASE_URL")
  if [[ "$sanitized" != "$DATABASE_URL" ]]; then
    echo "WARN  DATABASE_URL had [brackets] around password — auto-stripping"
    DATABASE_URL="$sanitized"
    export DATABASE_URL
  fi
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  if ! DATABASE_URL="$DATABASE_URL" ./scripts/test-database-url.sh >/dev/null 2>&1; then
    echo "BLOCKED: DATABASE_URL resolves but Postgres auth fails — fix password on Railway or set DATABASE_PASSWORD secret"
    echo ""
    ./scripts/check-p0-readiness.sh 2>/dev/null || true
    exit 1
  fi
  export DATABASE_URL
  ./scripts/apply-p0-autopilot.sh
  exec ./scripts/post-p0-success.sh
fi

echo ""
./scripts/check-p0-readiness.sh 2>/dev/null || true
echo ""
./scripts/founder-parallel-work.sh 2>/dev/null || true
if ./scripts/check-founder-parallel-ready.sh >/dev/null 2>&1; then
  echo ""
  echo "Founder parallel probes green — sole blocker is DATABASE_PASSWORD / Railway deploy"
  echo "Recovery: ./scripts/guide-worker-recovery.sh"
  echo "Playbooks: ./scripts/guide-founder-parallel.sh · docs/GUIDE_INDEX.md"
elif ./scripts/check-parallel-growth.sh >/dev/null 2>&1; then
  echo ""
  echo "Parallel growth gates green — sole blocker is DATABASE_PASSWORD / Railway deploy"
  echo "Recovery: ./scripts/guide-worker-recovery.sh"
  echo "Founder playbook: ./scripts/guide-founder-parallel.sh"
fi
exit 1
