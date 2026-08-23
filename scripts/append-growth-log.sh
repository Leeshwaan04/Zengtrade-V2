#!/usr/bin/env bash
# Append a session block to docs/GROWTH_DASHBOARD.md (daily autopilot log).
# Usage:
#   ./scripts/append-growth-log.sh 109 "Short title" \
#     --cto "shipped bullet" --cpo "..." --cbo "..."
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
GROWTH="$ROOT/docs/GROWTH_DASHBOARD.md"

SESSION="${1:?session number required}"
TITLE="${2:?session title required}"
shift 2

CTO_SHIPPED=""
CPO_SHIPPED=""
CBO_SHIPPED=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --cto) CTO_SHIPPED="$2"; shift 2 ;;
    --cpo) CPO_SHIPPED="$2"; shift 2 ;;
    --cbo) CBO_SHIPPED="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if grep -q "(session ${SESSION})" "$GROWTH"; then
  echo "Session ${SESSION} already in GROWTH_DASHBOARD.md — skip"
  exit 0
fi

STATUS_BLOCK=$(./scripts/log-growth-session.sh "$SESSION")

BLOCK="### Day 1 (session ${SESSION}) — ${TITLE}

### CTO
- **Shipped:** ${CTO_SHIPPED:-—}
- **Blocked:** Railway Postgres password still invalid.

### CPO
- **Shipped:** ${CPO_SHIPPED:-—}

### CBO
- **Shipped:** ${CBO_SHIPPED:-—}

${STATUS_BLOCK}
"

export BLOCK SESSION
SESSION="$SESSION"
python3 <<'PY'
import os
from pathlib import Path

growth = Path("docs/GROWTH_DASHBOARD.md")
text = growth.read_text(encoding="utf-8")
block = os.environ["BLOCK"]
session = os.environ.get("SESSION", "")

# Always append before the daily template separator (avoids mid-block inserts).
marker = "\n---\n\n## Daily log template"
if marker not in text:
    marker = "## Daily log template"
    if marker not in text:
        raise SystemExit("Could not find insert point in GROWTH_DASHBOARD.md")

text = text.replace(marker, "\n" + block + marker, 1)
growth.write_text(text, encoding="utf-8")
print(f"Appended session {session} before daily template")
PY
