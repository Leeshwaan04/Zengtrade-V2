-- 2026-09-06 VAPT finding (CRITICAL): deployment.params is a bare jsonb column with no shape
-- constraint. saas/worker/worker.py's _process() called json.loads() on it when it wasn't
-- already a dict; a jsonb SCALAR (a plain string, number, array, or bool, all legal jsonb
-- values) crashed with an uncaught TypeError/JSONDecodeError. Any authenticated user, even
-- free tier, could set this directly via a REST PATCH/POST to their own deployment row
-- (RLS's own_deployment policy allows it, this needs no special privilege), bypassing the
-- Builder UI entirely. Because the bad row persists with status='running', the worker
-- crash-looped on every restart, taking paper trading down for EVERY customer, not just the
-- one bad row.
--
-- worker.py now guards against this in application code (see _process()), but that's a second
-- line of defense, not the first: this constraint stops a non-object params value from ever
-- being written at all, regardless of which code path (this app, a future feature, a manual
-- API call) tries to write it.
alter table deployment
  add constraint deployment_params_is_object
  check (params is null or jsonb_typeof(params) = 'object');
