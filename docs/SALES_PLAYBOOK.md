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
2. **Signup** — `signup_complete` event
3. **Activation** — deploy → first closed trade (builds trust to buy)
4. **Intent** — `plan_intent` from `?plan=pro|elite`
5. **Checkout** — `checkout_click` → invoice → `?paid=1` poll
6. **Retention** — usage in `/app`, upgrade stickiness

Founder test: **https://zengtrade.in/ops/billing**

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

## Verification

```bash
./scripts/verify-billing.sh
./scripts/check-pricing-truth.sh
./scripts/check-migrations.sh   # checkout_click requires 0011
```

## Upgrade triggers (in-app)

- Free deploy limit hit → toast + `/app#pricing`
- Activation checklist complete + not Pro → soft upsell on dashboard
- `?plan=pro` after login → pricing tab + toast

## Do not

- Promise live exchange execution as shipped
- Share invoice or API secrets in support channels
