#!/usr/bin/env bash
# Token-gated launcher for the Indian paper harness, run under a KeepAlive LaunchAgent.
#
# WHY: the Indian bot needs a fresh Kite access_token daily (SEBI ~6am IST expiry). If launchd
# blindly restarted paper_trade_all.py while the token was stale, it would crash-loop at startup
# (load_instruments raises). Instead, this guard checks the token first:
#   • valid   -> exec the harness (runs until killed / reboot).
#   • stale   -> log, wait 5 min, exit cleanly. launchd (KeepAlive) re-runs us; once the morning
#                login has refreshed .env, the next retry starts the harness. No crash-loop, and
#                the bot self-recovers after login WITHOUT a manual restart.
cd "$(dirname "$0")" || exit 1
PY=/Library/Frameworks/Python.framework/Versions/3.13/bin/python3

if "$PY" - <<'PYEOF'
import sys
try:
    from bot.config import load_env, require
    from bot import auth
    load_env()
    auth.make_kite(require("KITE_API_KEY"), require("KITE_ACCESS_TOKEN")).profile()
    sys.exit(0)
except Exception:
    sys.exit(1)
PYEOF
then
    echo "$(date '+%F %T') token OK — starting Indian paper harness"
    exec "$PY" paper_trade_all.py
else
    echo "$(date '+%F %T') Kite token stale — waiting 5m for the daily login, then launchd retries"
    sleep 300
    exit 0
fi
