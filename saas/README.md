# zengtrade SaaS — multi-tenant paper platform

The public, multi-user product. Anyone signs up, paper-trades the crypto strategy library on live
prices, and sees an honest, cost-adjusted track record. **Paper only — non-custodial, no real orders.**
That's deliberate: it keeps the product free of the licensing/custody exposure that live execution carries.

```
saas/
  db/schema.sql      Postgres schema + Row-Level Security (the isolation backbone)
  web/
    login.html       sign in / create account (Supabase auth)
    app.html         protected per-user dashboard
    css.css          shared design system
    js/auth.js       auth module + route guard
    js/config.js     <- YOUR Supabase keys go here
```

## Go live in ~20 minutes

### 1. Create the database + auth (Supabase, free tier)
1. supabase.com → **New project** (pick a region near your users).
2. **SQL Editor** → paste all of `db/schema.sql` → **Run**. That creates the tables *and* the
   RLS policies that make one user's data unreadable to another.
3. **Settings → API** → copy the **Project URL** and the **anon public key**.
4. Paste both into `web/js/config.js`.
5. **Authentication → Providers** → enable **Email**. (Optional: enable **Google** for one-tap signup.)
6. **Authentication → URL Configuration** → set Site URL to your domain, and add
   `https://<your-domain>/app.html` as a redirect URL.

> The anon key is *designed* to ship in browsers — RLS is what protects the data, not key secrecy.

### 2. Deploy the site (free)
Any static host works — the app is plain HTML/JS.
- **Cloudflare Pages**: connect the repo (or drag-drop `saas/web/`), build command: none, output dir: `web`.
- Or Vercel / Netlify / GitHub Pages.

### 3. Point the domain
`www.zengtrade.in` → the Pages deployment. (Requires the domain's nameservers to be on Cloudflare.)

### 4. Verify multi-tenancy actually works
1. Sign up as **user A**, deploy 2 strategies.
2. Open a private window, sign up as **user B**.
3. **User B must see an empty book.** If they see A's strategies, RLS isn't on — stop and fix before launch.

## What's built vs what's next
- [x] Auth: email+password, magic link, Google OAuth, password reset, route guard
- [x] Per-user isolation: schema + RLS policies + profile bootstrap
- [x] Per-user dashboard: deploy/stop strategies, live stats from *their* rows
- [ ] Worker: run the Python strategy engine per user and write `trade` / `book_state`
- [ ] Evidence tabs (Forward Test / Accuracy / Analytics) scoped per user
- [ ] Billing (Lemon Squeezy / Paddle) + Pro entitlements
- [ ] Terms / Privacy / risk-disclaimer pages

## Non-negotiables
- **Paper only** at this stage. No live orders, no exchange keys, no custody.
- **Never** guarantee returns or give personalised advice — this is software, not investment advice.
- Terms + Privacy + risk disclaimer must ship before the first paying user.

---

## Billing (Lemon Squeezy) — setup

Model: **Free = 1 paper strategy · Pro ($29/mo) = unlimited + live execution when a strategy clears
the bar.** Non-custodial, hosted checkout, no card data ever touches us.

### 1. Lemon Squeezy
1. Create a store → add a **Subscription product** "zengtrade Pro", $29/mo.
2. Product → the Pro **variant** → note the **Variant ID** and your **store slug**.
3. Put both in `web/js/config.js` → `LEMONSQUEEZY.storeSlug` / `.proVariantId` (public — safe).
4. Settings → **Webhooks** → add `https://<PROJECT>.supabase.co/functions/v1/lemonsqueezy-webhook`,
   sign with a strong secret, subscribe to `subscription_*` events. Save the signing secret.
5. Rotate the API key you exposed earlier (Settings → API) — it's only needed for server-side API
   calls (not required for this webhook flow).

### 2. Deploy the webhook (Supabase Edge Function)
```bash
supabase login
supabase link --project-ref ponvarxeytfcntckczbn
supabase secrets set LEMONSQUEEZY_WEBHOOK_SECRET=<the signing secret from step 4>
supabase functions deploy lemonsqueezy-webhook --no-verify-jwt
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically. The service role is what
lets the webhook flip `profile.tier` past RLS — it lives only in the function's env, never in the browser.

### 3. Flow
```
Free user hits deploy limit / clicks Upgrade
   → hosted LS checkout (email + user_id prefilled)
   → payment → LS fires webhook → signature verified → profile.tier = 'pro'
   → dashboard unlocks unlimited strategies
Cancel/expire → webhook sets tier back to 'free'
```
Idempotent via the `webhook_event` table (duplicate events are skipped).

### ⚠️ Don't charge yet
The rail is built, but **activate paid tiers only once a strategy is forward-proven** (Accuracy bar).
Billing on an unproven edge just collects refunds. `trend_follow` is backtest-promising — run it
forward first.
