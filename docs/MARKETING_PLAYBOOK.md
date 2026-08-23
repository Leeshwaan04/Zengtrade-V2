# Marketing Playbook — zengtrade

Owner: **Marketing Lead autopilot** (`.cursor/autopilot/marketing.md`)

## Positioning (always)

> Honest paper trading on live crypto prices. Forward evidence before any live talk. ~35 bps round-trip on spot baked in.

## UTM convention

| Param | Values |
|-------|--------|
| `utm_source` | `site`, `reddit`, `twitter`, `linkedin`, `gsc` |
| `utm_medium` | `organic`, `social`, `community`, `email` |
| `utm_campaign` | `landing`, `pricing`, `coin_btc`, `weekly_proof`, `algotrading_draft` |

Signup URL template:

```
https://zengtrade.in/login?mode=signup&utm_source={source}&utm_medium={medium}&utm_campaign={campaign}
```

Pro intent:

```
https://zengtrade.in/login?mode=signup&plan=pro&utm_source=...
```

## Parallel work (worker blocked — GSC + activation)

Founder/CBO can run these **before** paper worker is live (no forward trades yet):

| Task | Link | Proof |
|------|------|-------|
| GSC verify + sitemap | https://zengtrade.in/ops/gsc | Search Console screenshot |
| Pro checkout smoke | https://zengtrade.in/ops/billing | Invoice created (test mode OK) |
| Signup → deploy UI | https://zengtrade.in/ops/e2e | Partial E2E when migration ✅ |

**Do not** claim forward P&L or closed trades until `./scripts/check-worker.sh` is green.

Pre-P0 LinkedIn angle (honest):

```
Shipping zengtrade in public — paper trading on live Binance prices.

Today: signup → Algo Studio → deploy is live on staging-grade infra.
Next: forward paper loop (worker deploy in progress).

Try the deploy path: https://zengtrade.in/login?mode=signup&utm_source=linkedin&utm_medium=social&utm_campaign=build_in_public

Not investment advice. Paper only.
```

Verify parallel gates before posting: `./scripts/check-parallel-growth.sh`

## Content calendar (post-P0)

| Week | Asset | Channel |
|------|-------|---------|
| 1 | Forward diary (template in `docs/content/WEEKLY_PROOF.md`) | X thread |
| 2 | "Backtest vs forward" explainer | LinkedIn |
| 3 | r/algotrading value post | Reddit (draft: `docs/content/REDDIT_ALGOTRADING_DRAFT.md`) |
| 4 | Coin spotlight #1 | Blog section on coin page |

**Coin spotlight template (week N):**

```
Coin of the week: [BTC/ETH/SOL] — regime read + paper-first angle

- What the 30-day tape looks like (honest, no hype)
- Which strategy style fits (trend vs mean-reversion) — paper only
- CTA: https://zengtrade.in/login?mode=signup&utm_source=site&utm_medium=organic&utm_campaign=coin_spotlight_[slug]

Not investment advice. Paper trading on live Binance prices.
```

**Gate:** Do not publish until `./scripts/verify-activation-path.sh` passes.

## Launch checklist (marketing)

- [ ] Hero + how-it-works aligned (paper loop)
- [ ] All CTAs tagged (`check-funnel-ctas.sh`)
- [ ] Screenshot pack: Forward Test tab (real data only)
- [ ] Founder bio + risk disclaimer linked from posts

## LinkedIn founder post (template — post after P0 E2E)

```
Most crypto "algos" sell backtests. We ship paper trading on live Binance prices first.

zengtrade runs regime-aware strategies 24/7 in paper — full cost model (~35 bps round-trip on spot), forward book only, no live execution promises.

If you're systematic and tired of fantasy equity curves:
→ Start free (paper): https://zengtrade.in/login?mode=signup&utm_source=linkedin&utm_medium=social&utm_campaign=founder_launch

Not investment advice. Paper-first by design.
```

## Assets (repo)

- `docs/content/REDDIT_ALGOTRADING_DRAFT.md`
- `docs/content/WEEKLY_PROOF.md`
- `/how-it-works/#paper-loop`

## Metrics (`/admin`)

- `signup_views_7d`, `signup_complete_7d`
- `pageviews_7d` by campaign (path/ref in events)

## Do not

- Paid ads before P0 green (coordinate CBO)
- Guaranteed returns or "AI beats the market" claims
