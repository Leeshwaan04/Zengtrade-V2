# zengtrade SaaS: multi-tenant paper platform

The public, multi-user product. Anyone signs up, paper-trades the crypto strategy library on live
prices, and sees an honest, cost-adjusted track record. **Paper only: non-custodial, no real orders.**
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

> The anon key is *designed* to ship in browsers, RLS is what protects the data, not key secrecy.

### 2. Deploy the site (free)
Any static host works: the app is plain HTML/JS.
- **Cloudflare Pages**: connect the repo (or drag-drop `saas/web/`), build command: none, output dir: `web`.
- Or Vercel / Netlify / GitHub Pages.

### 3. Point the domain
`www.zengtrade.in` → the Pages deployment. (Requires the domain's nameservers to be on Cloudflare.)

### 4. Verify multi-tenancy actually works
1. Sign up as **user A**, deploy 2 strategies.
2. Open a private window, sign up as **user B**.
3. **User B must see an empty book.** If they see A's strategies, RLS isn't on, stop and fix before launch.

## What's built vs what's next
- [x] Auth: email+password, magic link, Google OAuth, password reset, route guard
- [x] Per-user isolation: schema + RLS policies + profile bootstrap
- [x] Per-user dashboard: deploy/stop strategies, live stats from *their* rows
- [ ] Worker: run the Python strategy engine per user and write `trade` / `book_state`
- [ ] Evidence tabs (Forward Test / Accuracy / Analytics) scoped per user
- [x] Billing (NOWPayments) + Pro entitlements
- [ ] Terms / Privacy / risk-disclaimer pages

## Non-negotiables
- **Paper only** at this stage. No live orders, no exchange keys, no custody.
- **Never** guarantee returns or give personalised advice, this is software, not investment advice.
- Terms + Privacy + risk disclaimer must ship before the first paying user.

---

## Billing (NOWPayments): setup

Model: **Free = 1 paper strategy · Pro ($19/mo founding) = unlimited + live execution when a
strategy clears the bar.** Non-custodial, hosted checkout, no card data ever touches us. The
checkout invoice is minted server-side by the `nowpayments-create-invoice` Edge Function; the
`nowpayments-ipn` function verifies NOWPayments' HMAC-SHA512 signature and grants the tier via the
`grant_paid()` Postgres function (service-role only, see `db/migrations/0005_grant_paid_and_deploy_limit.sql`).
Idempotent via the `webhook_event` table (duplicate IPN events are skipped). See
`saas/deploy_nowpayments.sh` to (re)deploy the functions and `saas/tests/nowpayments_signature.mjs`
to verify a forged webhook is rejected.

(This repo has previously tried Lemon Squeezy and Polar for billing, both were removed
2026-09-06 along with their webhook functions and deploy scripts. NOWPayments is the only live
provider; don't resurrect the others without a reason to actually switch.)
