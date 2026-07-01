#!/usr/bin/env bash
# One command to start a paper-trading day. Run AFTER `python3 login.py`.
#   ./start_paper.sh
# Verifies the Kite token, ensures the dashboard API is up, then runs the
# forward paper harness in the foreground (Ctrl-C saves state and exits).
set -euo pipefail
cd "$(dirname "$0")"

echo "→ Refreshing Kite token (auto-login if configured)…"
python3 auto_login.py || echo "  (auto-login not set up or failed — will check the existing token)"

echo "→ Checking Kite token…"
python3 - <<'PY'
import sys
from bot.config import load_env, require
from bot import auth
load_env()
try:
    k = auth.make_kite(require("KITE_API_KEY"), require("KITE_ACCESS_TOKEN"))
    name = k.profile().get("user_name")
    print(f"  TOKEN OK — {name}")
except Exception as e:
    print("  TOKEN INVALID:", str(e)[:80])
    print("  → Run:  python3 login.py   then retry ./start_paper.sh")
    sys.exit(1)
PY

if ! pgrep -f "bot_api.py" >/dev/null 2>&1; then
  echo "→ Starting dashboard API (http://localhost:8756)…"
  python3 bot_api.py >bot_api.log 2>&1 &
  sleep 1
else
  echo "→ Dashboard API already running (http://localhost:8756)"
fi

echo "→ Starting forward paper harness — PAPER mode, no real orders. Ctrl-C to stop."
exec python3 paper_trade_all.py
