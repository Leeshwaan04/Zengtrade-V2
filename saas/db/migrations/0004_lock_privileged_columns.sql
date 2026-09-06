-- zengtrade: P0 SECURITY FIX: stop users self-granting a paid tier / forging their track record.
--
-- RLS is ROW-level, not column-level. The old `own_profile ... with check (id = auth.uid())` policy
-- authorised a user to UPDATE their OWN profile row, tier column included, so a logged-in free user
-- could run `sb.from('profile').update({tier:'elite'})` from the browser and unlock everything for $0.
-- Postgres COLUMN grants are enforced independently of RLS, so we take table-level write off profile
-- and re-grant only the non-billing columns. subscription/trade/book_state become read-only to users
-- (written solely by the service role / worker, which bypass RLS).

-- ---- profile.tier: readable by owner, NEVER writable by the browser ----
revoke update on profile from anon, authenticated;
grant  update (display_name, risk_ack_at) on profile to authenticated;
revoke insert on profile from anon, authenticated;
grant  insert (id, display_name, risk_ack_at) on profile to authenticated;
-- (SELECT is unchanged: the client still reads its own tier via the own_profile policy.)

-- ---- subscription: fully server-managed billing mirror. Owner may READ; service role writes. ----
drop policy own_subscription on subscription;
create policy sub_read on subscription for select using (user_id = auth.uid());

-- ---- trade + book_state: written ONLY by the strategy worker. Users read-only, so nobody can ----
-- fabricate their own P&L / win-rate (the product's core "honest track record" claim).
drop policy own_trade on trade;
create policy trade_read on trade for select using (user_id = auth.uid());
drop policy own_book on book_state;
create policy book_read on book_state for select using (user_id = auth.uid());
