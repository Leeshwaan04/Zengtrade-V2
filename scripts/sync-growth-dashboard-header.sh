#!/usr/bin/env bash
# Update probe rows in docs/GROWTH_DASHBOARD.md header table (worker, parallel, sales).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
GROWTH="$ROOT/docs/GROWTH_DASHBOARD.md"

work=0 parallel=0 sales=0 mig=0
./scripts/check-migrations.sh >/dev/null 2>&1 && mig=1
./scripts/check-worker.sh >/dev/null 2>&1 && work=1
./scripts/check-parallel-growth.sh >/dev/null 2>&1 && parallel=1
./scripts/check-sales-ready.sh >/dev/null 2>&1 && sales=1

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

parallel_today=$([[ $parallel -eq 1 ]] && echo "5/5 gates ✅" || echo "❌ run ./scripts/check-parallel-growth.sh")
sales_today=$([[ $sales -eq 1 ]] && echo "✅ check-sales-ready.sh" || echo "❌")

export WORKER_TODAY="$worker_today" PARALLEL_TODAY="$parallel_today" SALES_TODAY="$sales_today" MIG_TODAY=$([[ $mig -eq 1 ]] && echo "✅" || echo "❌")
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
sub_row("Parallel growth (excl. worker)", os.environ["PARALLEL_TODAY"])

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

growth.write_text(text, encoding="utf-8")
print(f"Updated GROWTH_DASHBOARD probes: worker={os.environ['WORKER_TODAY'][:40]}…")
PY
