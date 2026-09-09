# Paper worker recovery runbook

Owner: **CTO autopilot** · Founder guide: **https://zengtrade.in/ops/worker**

The paper worker (`saas/worker/`) connects to Supabase Postgres and runs strategies for every ACTIVE
paper deployment. Without a fresh heartbeat, users can **deploy** but **no trades** appear on the
Forward tab.

## Current home: Google Cloud Run Jobs + Cloud Scheduler (since 2026-09-09)

Railway's `paper-worker` service hit a persistent platform-side failure (builds stuck at
"scheduling build on Metal builder", never progressing, 8 consecutive failures across 2 days from
independent triggers, with billing/config/GitHub connection all confirmed fine). Rather than keep
waiting on Railway support, the worker moved to GCP:

- **Cloud Run Job** `paper-worker` (project `zengtrade`, region `us-central1`) runs
  `python worker.py --once`, one cycle, then exits. No continuous process to keep alive.
- **Cloud Scheduler** job `paper-worker-cycle` (same region) triggers a new execution every 5
  minutes via `POST https://us-central1-run.googleapis.com/v2/projects/zengtrade/locations/us-central1/jobs/paper-worker:run`,
  authenticated as the Compute Engine default service account (granted `roles/run.invoker` on the
  job specifically, not project-wide).
- **`DATABASE_URL`** lives in **Secret Manager** (`zengtrade-worker-db-url`, referenced as
  `:latest`), encrypted at rest, IAM-scoped, not a plain environment variable. This is a real
  improvement over how Railway stored it.
- Cost: scale-to-zero between runs, well inside Cloud Run's free tier (~300 vCPU-seconds/day
  against a 180,000/month free allowance). Expect **$0/month** in the normal case.
- The container is the **same image** built from `saas/worker/Dockerfile`, no worker code changed,
  only how and where it runs.

### Diagnose (no secrets printed)

```bash
gcloud run jobs executions list --job=paper-worker --region=us-central1 --project=zengtrade --limit=10
gcloud scheduler jobs describe paper-worker-cycle --location=us-central1 --project=zengtrade
```

Supabase SQL (or REST, shown below), same check as always:

```sql
select key, updated_at, value from engine_state where key = '_worker_heartbeat';
```

```bash
curl -s "https://ponvarxeytfcntckczbn.supabase.co/rest/v1/engine_state?key=eq._worker_heartbeat" \
  -H "apikey: sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1"
```

Expected when healthy: `updated_at` within **12 minutes** (each execution logs `startup heartbeat
ok`, matching the original Railway convention).

### If it stops updating

1. Check `gcloud run jobs executions list` (above), a run of consecutive `FAILED` executions means
   something broke; `gcloud logging read 'resource.type="cloud_run_job" AND
   resource.labels.job_name="paper-worker"' --project=zengtrade --limit=50` shows why (usually a DB
   auth error, same symptoms/hints as the old runbook: wrong password, wrong pooler port).
2. If executions aren't appearing at all every 5 minutes, check the Scheduler job is `ENABLED`
   and its `uri` is the **v2** API path shown above, the legacy `v1/namespaces/.../jobs/...:run`
   path (still returned by some older docs/examples) accepts the request but silently never
   triggers a real execution. This cost real debugging time once already; don't reintroduce it.
3. To rotate the DB password (Supabase → Database settings → reset → copy the **session pooler**
   URI, port `5432`, not transaction `6543`):
   ```bash
   read -s -p "Paste the new DATABASE_URL: " DBURL && echo
   printf "%s" "$DBURL" | gcloud secrets versions add zengtrade-worker-db-url --data-file=- --project=zengtrade
   ```
   No redeploy needed, every execution reads the `:latest` secret version fresh.
4. To rebuild after a code change to `saas/worker/`: from Cloud Shell (Docker isn't required
   locally, Cloud Build's `builds.create` API blocked this project outright as a new-account
   anti-fraud measure; Cloud Shell's pre-installed Docker sidesteps it entirely):
   ```bash
   cd Zengtrade-V2/saas/worker   # git pull first if the clone already exists
   docker build -t us-central1-docker.pkg.dev/zengtrade/zengtrade/paper-worker:latest .
   docker push us-central1-docker.pkg.dev/zengtrade/zengtrade/paper-worker:latest
   ```
   (If `docker push` fails with `connect: connection refused` to a googleapis.com IP, just retry:
   this happened twice in a row before succeeding on the third attempt; a genuine transient Google
   network blip, not a config problem. A fresh Cloud Shell session, if retries keep failing, gets a
   new VM with a different network path.)
   The Cloud Run Job always pulls `:latest` on its next scheduled execution, no separate deploy
   step needed after a successful push.
5. Manual one-off test run (useful after any change, without waiting for the next 5-minute tick):
   ```bash
   gcloud run jobs execute paper-worker --region=us-central1 --project=zengtrade --wait
   ```

### Stop / rollback (safe)

Stopping the schedule does **not** delete deployments or historical trades, users simply stop
getting new paper fills until it resumes.

```bash
gcloud scheduler jobs pause paper-worker-cycle --location=us-central1 --project=zengtrade   # stop
gcloud scheduler jobs resume paper-worker-cycle --location=us-central1 --project=zengtrade  # resume
```

## Legacy: Railway (superseded 2026-09-09, kept for history)

The original deployment target was Railway's `paper-worker` service
([project f5902ffd-5b3f-49ed-b87d-dad21568185b](https://railway.app/project/f5902ffd-5b3f-49ed-b87d-dad21568185b)),
running the worker continuously (`python worker.py --interval 300`) rather than on a schedule. It
is **no longer the source of truth**, its deploys were stuck failing at the build-scheduling step
for the service's entire final 2 days of use, root-caused to a platform-side issue on Railway's end
(confirmed via their own deployment diagnosis calling it an "Infrastructure Error", not a config or
billing problem, payment method was verified valid throughout). The service was left in place
rather than deleted; it costs nothing while failing to build, but is safe to remove from the
Railway dashboard whenever convenient. `saas/worker/Dockerfile` and `railway.toml` still describe
how it would deploy there if ever needed again as a fallback.

## Related docs

- `saas/worker/README.md`: local run + hosting options
- `docs/LAUNCH_RUNBOOK.md`: full launch checklist
- `docs/FOUNDER_DEPLOY.md`: 30-minute founder checklist
