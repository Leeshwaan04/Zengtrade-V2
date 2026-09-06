# Worker quickstart (founder: ~10 min)

Paper trades **do not run** without this process. Site + auth can be live while worker is down.

## 1. Check status

```bash
./scripts/check-worker.sh
```

## 2. Railway (recommended)

1. [railway.app/new](https://railway.app/new) → **Deploy from GitHub** → `Leeshwaan04/Zengtrade-V2`
2. Service settings → **Root directory**: `saas/worker`
3. **Variables** → add:
   - `DATABASE_URL` = Supabase → Project Settings → Database → **URI** (session pooler, port 5432)
   - `WORKER_INTERVAL` = `300` (optional)
4. Deploy → Logs should show: `zengtrade worker · … featured strategies` then **`startup heartbeat ok`**
5. Re-run `./scripts/check-worker.sh`: heartbeat must be **< 12 min**

## 3. Verify in product

- Deploy a strategy on `/dashboard`
- Wait one cycle (~5 min)
- `/app#forward` or `/app#activity` shows closed trades
- `/admin` → Worker tile = **Live**

## 5. Migrations (if funnel events fail)

```bash
./scripts/migrate-0011-only.sh   # paste into Supabase SQL Editor
./scripts/check-migrations.sh
```

See also: `docs/FOUNDER_DEPLOY.md`
