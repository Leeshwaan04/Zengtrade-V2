# Marketing Playbook: zengtrade

Owner: **Marketing Lead autopilot** (`.cursor/autopilot/marketing.md`)

## Positioning (always)

> Honest paper trading on live crypto prices. Forward evidence before any live talk. ~35 bps round-trip on spot baked in.

## UTM convention

| Param | Values |
|-------|--------|
| `utm_source` | `site`, `reddit`, `twitter`, `linkedin`, `gsc` |
| `utm_medium` | `organic`, `social`, `community`, `email` |
| `utm_campaign` | `landing`, `pricing`, `pricing_pro`, `pricing_elite`, `home_coins`, `pricing_coins`, `coins_hub`, `coins_hub_pro`, `coin_{slug}_pro`, `signup_coins`, `signup_nudge_coins`, `deploy_success_coins`, `paper_loop`, `paper_loop_coins`, `paper_loop_pro`, `build_in_public`, `build_in_public_pro`, `build_in_public_coins`, `weekly_proof`, `weekly_proof_partial`, `weekly_proof_pro`, `coin_spotlight_{slug}`, `coin_spotlight_hub`, `coin_spotlight_deploy`, `coin_spotlight_evidence`, `algotrading_draft` |

Signup URL template:

```
https://zengtrade.in/login?mode=signup&utm_source={source}&utm_medium={medium}&utm_campaign={campaign}
```

Pro intent:

```
https://zengtrade.in/login?mode=signup&plan=pro&utm_source=...
```

## Parallel work (worker blocked, GSC + activation)

Founder/CBO can run these **before** paper worker is live (no forward trades yet):

| Task | Link | Proof |
|------|------|-------|
| GSC verify + sitemap | https://zengtrade.in/ops/gsc | Search Console screenshot |
| Pro checkout smoke | https://zengtrade.in/ops/billing | Invoice created (test mode OK) |
| Signup → deploy UI | https://zengtrade.in/ops/e2e | Partial E2E when migration ✅ |
| Login coins discovery | `/login` → `signup_coins` UTM | `./scripts/check-funnel-ctas.sh` |
| Partial proof posts | `docs/content/WEEKLY_PROOF.md` § Partial | `./scripts/guide-linkedin-bip.sh` |
| Founder playbook (all parallel) | `./scripts/guide-founder-parallel.sh` | CLI summary |

**Do not** claim forward P&L or closed trades until `./scripts/check-worker.sh` is green.

Pre-P0 LinkedIn angle (honest: parallel gates green, worker password fix in progress):

**Founder-ready draft:** `docs/content/LINKEDIN_BUILD_IN_PUBLIC.md`

```
Shipping zengtrade in public: paper trading on live Binance prices.

Today on production: signup → Algo Studio → deploy is live (partial E2E steps 1–2).
Next: forward paper loop once our worker is back (DB credential fix in progress).

Try the deploy path: https://zengtrade.in/login?mode=signup&utm_source=linkedin&utm_medium=social&utm_campaign=build_in_public

Not investment advice. Paper only. No live execution.
```

Verify parallel gates before posting: `./scripts/check-parallel-growth.sh`

## Content calendar (post-P0)

| Week | Asset | Channel |
|------|-------|---------|
| 1 | Forward diary (template in `docs/content/WEEKLY_PROOF.md`) | X thread |
| 2 | "Backtest vs forward" explainer | LinkedIn |
| 3 | r/algotrading value post | Reddit (draft: `docs/content/REDDIT_ALGOTRADING_DRAFT.md`) |
| 4 | Coin spotlight #1 | Blog section on coin page |

**Coin spotlight template (week N):** run `./scripts/guide-coin-spotlight.sh [slug]` for founder-ready copy.

```
Coin of the week: [BTC/ETH/SOL] · regime read + paper-first angle

- What the 30-day tape looks like (honest, no hype)
- Which strategy style fits (trend vs mean-reversion), paper only
- CTA: https://zengtrade.in/login?mode=signup&utm_source=site&utm_medium=organic&utm_campaign=coin_spotlight_[slug]
- Deploy → evidence: `/dashboard` deploy · View evidence → `/app#forward` (partial OK while worker down)

Not investment advice. Paper trading on live Binance prices.
```

**Gate:** LinkedIn/coin spotlight (partial activation): `./scripts/check-parallel-growth.sh` green. Forward-proof posts: `./scripts/verify-activation-path.sh` passes.

## Launch checklist (marketing)

- [ ] Hero + how-it-works aligned (paper loop)
- [ ] All CTAs tagged (`check-funnel-ctas.sh`)
- [ ] Screenshot pack: Forward Test tab (real data only)
- [ ] Founder bio + risk disclaimer linked from posts

## LinkedIn founder post (template, post after P0 E2E)

```
Most crypto "algos" sell backtests. We ship paper trading on live Binance prices first.

zengtrade runs regime-aware strategies 24/7 in paper: full cost model (~35 bps round-trip on spot), forward book only, no live execution promises.

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
