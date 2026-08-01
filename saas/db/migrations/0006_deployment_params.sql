-- Custom (user-composed) strategies: the Builder saves a validated rule spec on the
-- user's own deployment row; the worker's RuleStrategy interpreter runs it through
-- the same engine.step as every built-in. strategy_key convention: 'custom_<slug>'.
alter table deployment add column if not exists params jsonb;
