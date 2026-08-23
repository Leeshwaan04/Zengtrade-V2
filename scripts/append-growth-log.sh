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
import re
from pathlib import Path

growth = Path("docs/GROWTH_DASHBOARD.md")
text = growth.read_text(encoding="utf-8")
block = os.environ["BLOCK"]
session = os.environ.get("SESSION", "")

nums = [int(m) for m in re.findall(r"session (\d+)\)", text)]
if nums:
    n = max(nums)
    anchor = f"log-growth-session.sh {n}"
    if anchor not in text:
        anchor = f"(session {n})"
    idx = text.find(anchor)
    if idx >= 0:
        line_end = text.find("\n", idx)
        insert_at = line_end + 1 if line_end >= 0 else len(text)
        text = text[:insert_at] + "\n" + block + text[insert_at:]
        growth.write_text(text, encoding="utf-8")
        print(f"Appended session {os.environ['SESSION']} after session {n}")
        raise SystemExit(0)

marker = "## Daily log template"
if marker not in text:
    raise SystemExit("Could not find insert point in GROWTH_DASHBOARD.md")
text = text.replace(marker, block + marker, 1)
growth.write_text(text, encoding="utf-8")
print(f"Appended session {os.environ['SESSION']} before daily template")
PY
