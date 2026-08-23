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

## Content calendar (post-P0)

| Week | Asset | Channel |
|------|-------|---------|
| 1 | Forward diary (template in `docs/content/WEEKLY_PROOF.md`) | X thread |
| 2 | "Backtest vs forward" explainer | LinkedIn |
| 3 | r/algotrading value post | Reddit (draft: `docs/content/REDDIT_ALGOTRADING_DRAFT.md`) |
| 4 | Coin spotlight #1 | Blog section on coin page |

**Gate:** Do not publish until `./scripts/verify-activation-path.sh` passes.

## Launch checklist (marketing)

- [ ] Hero + how-it-works aligned (paper loop)
- [ ] All CTAs tagged (`check-funnel-ctas.sh`)
- [ ] Screenshot pack: Forward Test tab (real data only)
- [ ] Founder bio + risk disclaimer linked from posts

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
