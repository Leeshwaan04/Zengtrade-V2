# zengtrade paper-trading worker

Runs the proven strategy on **live Binance data** for every ACTIVE paper deployment across all
users, writing trades + book_state back to Supabase. This is what makes deployed strategies
actually *trade* — the site is inert without it running.

Self-contained: the needed `bot/` modules (crypto_data, strategies_lib, indicators) are vendored
here, so it has no dependency on the kite repo.

## Run modes
```
python worker.py --once            # one live cycle (test)
python worker.py --replay 800      # backfill real history (seed/demo)
python worker.py                   # continuous, every WORKER_INTERVAL sec (default 300)
```

## Config
Copy `.env.example` -> `.env`, set `DATABASE_URL` to your Supabase Postgres URI (Project Settings
-> Database -> Connection string). Use the **rotated** DB password. Never commit `.env`.

## Where to host (pick one)

**Production (current):** Railway service `paper-worker` in project `ravishing-tenderness` — set `DATABASE_URL` (Supabase **session** pooler port **5432**):

```
postgresql://postgres.ponvarxeytfcntckczbn:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
```

Founder/agent unblock: Cloud Agent `DATABASE_PASSWORD` only → `./scripts/run-p0-if-ready.sh` on repo `main`.  
Verify: `./scripts/check-worker.sh` (heartbeat < 12 min). Guide: https://zengtrade.in/ops/worker  
Recovery runbook: `docs/WORKER_RECOVERY.md`

**A) Docker host — Railway (easiest, ~$5/mo):**
```
# from saas/worker/
railway up            # see railway.toml; set DATABASE_URL in dashboard
```
The Dockerfile runs continuous mode automatically. (Render and Fly.io configs existed here
briefly during earlier autopilot sessions and were removed 2026-09-06 — Railway is the one
actual deploy target; don't re-add alternates without a reason to actually use them.)

**B) Plain Linux VPS (systemd):**
```
sudo mkdir -p /opt/zengtrade-worker && sudo cp -r . /opt/zengtrade-worker/
cd /opt/zengtrade-worker
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env   # then edit DATABASE_URL
sudo cp zengtrade-worker.service /etc/systemd/system/
sudo systemctl enable --now zengtrade-worker
sudo journalctl -u zengtrade-worker -f    # watch it
```

**C) Cron (simplest, coarser cadence):** a `*/5 * * * *` job running `python worker.py --once`.

## Verify it's working
After a cycle, check Supabase: `select count(*) from trade;` grows, and `book_state` rows update.
The user's dashboard then shows live P&L.

## Notes
- Reads `deployment` where `mode='paper' and status='running'` — so it only works on strategies
  users actually deployed. RLS doesn't block it: the worker connects with the DB role (service),
  not a user JWT.
- Binance data is public (no key). No exchange keys live here — paper only.
