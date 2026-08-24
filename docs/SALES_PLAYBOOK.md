# Sales Playbook — zengtrade

Owner: **Sales Manager autopilot** (`.cursor/autopilot/sales.md`)

## Offer (paper tier)

| Plan | Price | Ships today |
|------|-------|-------------|
| Free | $0 | 1 paper strategy, full forward book |
| Pro (founding) | $19/mo | Unlimited paper strategies; live **coming soon** |
| Elite | $79/mo | Builder + priority; live **coming soon** |

Checkout: NOWPayments crypto invoice → IPN grants tier via `grant_paid` RPC.

## Funnel stages

1. **Awareness** — SEO / marketing → landing
2. **Signup** — `signup_complete` event · default lands on `/dashboard` (Algo Studio) · `?plan=pro|elite` → `/app#pricing`
3. **Activation** — deploy → first closed trade (builds trust to buy)
4. **Intent** — `plan_intent` from `?plan=pro|elite` (pricing/coins/social UTMs); `utm_campaign` flows to `checkout_click` path via `zt_checkout_ref`
5. **Checkout** — `checkout_click` → invoice → `?paid=1` poll  
   Path suffixes: `:free_limit_upgrade` (free cap hit), `:deploy_success_pro` (post-deploy upsell), `:forward_empty_pro` (Forward Test empty state)
6. **Retention** — usage in `/app`, upgrade stickiness

Founder test: **https://zengtrade.in/ops/billing**

## Parallel work (worker blocked)

Billing and plan-intent can be verified **before** paper trades exist:

| Check | Command / link |
|-------|----------------|
| Billing-ready probe | `./scripts/check-billing-ready.sh` |
| Sales-ready (full checkout path) | `./scripts/check-sales-ready.sh` |
| Founding $19 on prod | `./scripts/check-production-pricing.sh` |
| Manual checkout smoke | https://zengtrade.in/ops/billing |
| Partial activation (no trades) | `./scripts/verify-activation-path.sh --partial` · https://zengtrade.in/ops/e2e |
| Organic signup (coins) | `/login` → `signup_coins` UTM · `./scripts/check-funnel-ctas.sh` |
| All parallel gates | `./scripts/check-parallel-growth.sh` |

Do not claim forward P&L or closed-trade activation until `./scripts/check-worker.sh` is green.

## Objection handling (honest)

| Objection | Response |
|-----------|----------|
| "Why paper?" | Live execution unlocks per strategy only after forward go-live bar — no backtest-only arming |
| "Why crypto invoice?" | Non-custodial; we don't hold cards or keys |
| "Is live trading included?" | Pro is unlimited **paper** today; live rail is on the roadmap with explicit go-live checklist |
| "Free limit?" | One running paper strategy; Pro removes cap |

## Weekly sales standup (`/admin`)

- MRR tile · `paying` · `checkout_clicks_7d` · `plan_intents_7d`
- `deploy_success_7d` (activated users ready to upgrade)
- When MRR = $0: `/admin` banner shows deploy-first trust path (`/dashboard` → View evidence → `/app#forward`) before `/ops/billing` checkout

## Verification

```bash
./scripts/check-sales-ready.sh      # billing + plan intent + pricing truth (one command)
./scripts/check-billing-ready.sh   # billing + founding $19 + checkout_click
./scripts/verify-billing.sh
./scripts/check-pricing-truth.sh
./scripts/check-production-pricing.sh   # founding $19 on /pricing + billing.js
./scripts/check-migrations.sh   # checkout_click requires 0011
```

## First Pro checkout (founder manual — worker not required)

Run when `./scripts/check-sales-ready.sh` is green.

| Step | Action | Success signal |
|------|--------|----------------|
| 1 | Open https://zengtrade.in/ops/billing | Page shows billing-ready ✓ |
| 2 | Sign up with Pro intent (`?plan=pro`) | Plan banner on `/login` · lands on `/app#pricing` |
| 2a | Same URL → **Continue with Google** | `prepOAuthSignup` preserves plan + `utm_campaign` → `zt_checkout_ref` on checkout |
| 2b | Organic: `/login` → Browse coin strategies (`signup_coins`) → `/app#pricing` | Same funnel, different UTM |
| 2c | Deploy first (recommended) | `/dashboard` deploy → post-deploy hint → `/app#forward` before checkout; yellow worker-offline banner also links **View evidence** |
| 3 | Start Pro checkout → complete NOWPayments invoice | Invoice created (test or real) |
| 4 | Return to `/app?paid=1` | Tier shows Pro within a few minutes |
| 5 | Open `/admin` | **Paying** count ≥ 1 · **MRR** > $0 · `checkout_clicks_7d` incremented |

**If tier does not flip:** check Supabase edge function logs for `nowpayments-ipn` · confirm IPN URL in NOWPayments dashboard · re-run `./scripts/security-smoke.sh` (unsigned POST must return 401).

**Honest positioning:** Pro is unlimited **paper** today; do not promise live execution in support or posts.

## Upgrade triggers (in-app)

- Free deploy limit hit → toast + `/app#pricing`
- Activation checklist complete + not Pro → soft upsell on dashboard
- `?plan=pro` after login → pricing tab + toast

## Do not

- Promise live exchange execution as shipped
- Share invoice or API secrets in support channels
