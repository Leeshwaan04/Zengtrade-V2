#!/usr/bin/env bash
# Update probe rows in docs/GROWTH_DASHBOARD.md header table (worker, parallel, sales).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
GROWTH="$ROOT/docs/GROWTH_DASHBOARD.md"

work=0 parallel=0 sales=0 qa=0 mig=0 partial=0 gsc=0 prod=0 db_auth="—"
./scripts/check-migrations.sh >/dev/null 2>&1 && mig=1
./scripts/check-worker.sh >/dev/null 2>&1 && work=1
SITE=https://zengtrade.in ./scripts/check-production.sh >/dev/null 2>&1 && prod=1
SITE=https://zengtrade.in ./scripts/check-gsc-ready.sh >/dev/null 2>&1 && gsc=1
if [[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" ]]; then
  if ./scripts/validate-database-credentials.sh >/dev/null 2>&1; then
    db_auth="✅"
  else
    db_auth="❌ /ops/worker"
  fi
fi
for _ in 1 2 3; do
  [[ $parallel -eq 1 && $sales -eq 1 ]] && break
  [[ $parallel -eq 0 ]] && ./scripts/check-founder-parallel-ready.sh >/dev/null 2>&1 && parallel=1
  [[ $sales -eq 0 ]] && ./scripts/check-sales-ready.sh >/dev/null 2>&1 && sales=1
  [[ $qa -eq 0 ]] && ./scripts/check-qa-parallel.sh >/dev/null 2>&1 && qa=1
  [[ $partial -eq 0 && $work -eq 0 && $mig -eq 1 ]] && ./scripts/verify-activation-path.sh --partial >/dev/null 2>&1 && partial=1
  sleep 2
done

hb=$(curl -sfL 'https://ponvarxeytfcntckczbn.supabase.co/rest/v1/engine_state?key=eq._worker_heartbeat&select=updated_at' \
  -H 'apikey: sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1' 2>/dev/null \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['updated_at'][:19] if d else 'none')" 2>/dev/null || echo "none")

if [[ $work -eq 1 ]]; then
  worker_today="Live (heartbeat fresh)"
elif [[ "$hb" != "none" ]]; then
  worker_today="Offline (last heartbeat $hb UTC · wrong Railway DB password)"
else
  worker_today="Offline (P0 — wrong Railway DB password)"
fi

parallel_today=$([[ $parallel -eq 1 ]] && echo "✅ founder-parallel-ready" || echo "❌ run ./scripts/check-founder-parallel-ready.sh")
partial_today=$([[ $partial -eq 1 ]] && echo "✅ verify-activation-path --partial" || echo "❌")
sales_today=$([[ $sales -eq 1 ]] && echo "✅ check-sales-ready.sh" || echo "❌")
qa_today=$([[ $qa -eq 1 ]] && echo "✅ check-qa-parallel.sh" || echo "❌")

db_auth_ok=0
[[ "$db_auth" == "✅" ]] && db_auth_ok=1
cto_goal_today=$([[ $prod -eq 1 && $mig -eq 1 && $work -eq 1 && $db_auth_ok -eq 1 ]] && echo "✅ auth+worker+DB" || echo "❌ /ops/worker")
if [[ $work -eq 1 ]]; then
  cpo_goal_today="✅ signup → trades"
elif [[ $partial -eq 1 ]]; then
  cpo_goal_today="partial ✅ (trades need worker)"
else
  cpo_goal_today="❌"
fi
cbo_goal_today=$([[ $gsc -eq 1 && $sales -eq 1 ]] && echo "✅ GSC+sales-ready · MRR founder" || echo "❌")

export WORKER_TODAY="$worker_today" PARALLEL_TODAY="$parallel_today" PARTIAL_TODAY="$partial_today" SALES_TODAY="$sales_today" QA_TODAY="$qa_today" DB_AUTH_TODAY="$db_auth" MIG_TODAY=$([[ $mig -eq 1 ]] && echo "✅" || echo "❌") \
  CTO_GOAL_TODAY="$cto_goal_today" CPO_GOAL_TODAY="$cpo_goal_today" CBO_GOAL_TODAY="$cbo_goal_today"
python3 <<'PY'
import os
import re
from pathlib import Path

growth = Path("docs/GROWTH_DASHBOARD.md")
text = growth.read_text(encoding="utf-8")

def sub_row(label: str, today: str) -> None:
    global text
    pat = rf"(\| {re.escape(label)} \| [^|]+ \|) [^|]+ (\|)"
    repl = rf"\1 {today} \2"
    new, n = re.subn(pat, repl, text, count=1)
    if n:
        text = new

sub_row("Worker status", os.environ["WORKER_TODAY"])
if "| DATABASE_URL auth |" in text:
    sub_row("DATABASE_URL auth", os.environ.get("DB_AUTH_TODAY", "—"))
else:
    needle = "| Worker status |"
    insert = f"| DATABASE_URL auth | — | {os.environ.get('DB_AUTH_TODAY', '—')} | — |\n"
    idx = text.find(needle)
    if idx >= 0:
        line_end = text.find("\n", idx)
        text = text[: line_end + 1] + insert + text[line_end + 1 :]

if "| Partial activation (signup→deploy) |" in text:
    sub_row("Partial activation (signup→deploy)", os.environ["PARTIAL_TODAY"])
else:
    needle = "| Worker status |"
    insert = f"| Partial activation (signup→deploy) | — | {os.environ['PARTIAL_TODAY']} | — |\n"
    idx = text.find(needle)
    if idx >= 0:
        line_end = text.find("\n", idx)
        text = text[: line_end + 1] + insert + text[line_end + 1 :]

sub_row("Parallel growth (excl. worker)", os.environ["PARALLEL_TODAY"])

if "| QA parallel |" in text:
    sub_row("QA parallel", os.environ["QA_TODAY"])
else:
    needle = "| Sales-ready |"
    insert = f"| QA parallel | — | {os.environ['QA_TODAY']} | — |\n"
    idx = text.find(needle)
    if idx >= 0:
        line_end = text.find("\n", idx)
        text = text[: line_end + 1] + insert + text[line_end + 1 :]

if "| Sales-ready |" in text:
    sub_row("Sales-ready", os.environ["SALES_TODAY"])
else:
    needle = "| Parallel growth (excl. worker) |"
    insert = (
        f"| Sales-ready | — | {os.environ['SALES_TODAY']} | — |\n"
    )
    idx = text.find(needle)
    if idx >= 0:
        line_end = text.find("\n", idx)
        text = text[: line_end + 1] + insert + text[line_end + 1 :]

for label, key in (
    ("Growth: CTO loop", "CTO_GOAL_TODAY"),
    ("Growth: CPO trades", "CPO_GOAL_TODAY"),
    ("Growth: CBO infra", "CBO_GOAL_TODAY"),
):
    today = os.environ.get(key, "—")
    if f"| {label} |" in text:
        sub_row(label, today)
    else:
        needle = "| QA parallel |"
        insert = f"| {label} | — | {today} | — |\n"
        idx = text.find(needle)
        if idx >= 0:
            line_end = text.find("\n", idx)
            text = text[: line_end + 1] + insert + text[line_end + 1 :]

growth.write_text(text, encoding="utf-8")
print(f"Updated GROWTH_DASHBOARD probes: worker={os.environ['WORKER_TODAY'][:40]}…")
PY
