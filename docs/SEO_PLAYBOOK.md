# SEO Playbook: zengtrade

Owner: **SEO Manager autopilot** (`.cursor/autopilot/seo.md`)

## Weekly rhythm

| Day | Task |
|-----|------|
| Mon | Run `./scripts/check-gsc-ready.sh` (sitemap + SEO + funnel CTAs + signup) on production |
| Wed | GSC: impressions/clicks for top 5 URLs (manual until API wired) |
| Fri | One pSEO or on-page improvement; rebuild landing if needed |

## GSC setup (founder once)

**Can run while worker is blocked**, indexing does not need paper trades. Proof posts should wait for P0.

1. [Add property](https://search.google.com/search-console) → `https://zengtrade.in`
2. Submit `https://zengtrade.in/sitemap.xml`
3. Request indexing: `/`, `/pricing/`, `/how-it-works/`, `/coins/bitcoin/`
4. Founder page: **https://zengtrade.in/ops/gsc**

## Coin pSEO pipeline

`seo/generate.py` is a content library, not a standalone script (its own `__main__` block says so) -
`deploy/landing/build.py` imports it and calls `G.get_coin_data()` to get every coin page's data.

```bash
python3 deploy/landing/build.py  # imports seo/generate.py, builds every page including /coins/*
./scripts/check-sitemap.sh       # verify URLs in production sitemap
```

Roster: real top-N Binance-tradable coins by CoinGecko market cap (339 as of session 220, cap
raised to 600 so the real ceiling falls out of the tradable/non-stable/non-tokenized-stock filters
- see `build_coin_universe()`'s docstring, not a fixed target).

**Data caching (session 220):** a plain code push used to cost the same 15-19 minutes as a
190-coin roster expansion, because coin price/candle data was re-fetched live from CoinGecko +
Binance on every single build. `get_coin_data()` now prefers `seo/coin_data_cache.json`, which
`.github/workflows/pages.yml` restores from the GitHub Actions cache (not git - it changes every
6h and would bloat repo history) on every run, but only *refreshes* on the workflow's `schedule`
trigger (every 6h) or a manual `workflow_dispatch`, via `seo/refresh_coin_data.py`. A normal push
just reads whatever was last cached and builds fast. If the cache is ever missing entirely (fresh
checkout, first-ever run), `get_coin_data()` falls back to a live fetch automatically - there's no
hard dependency on the cache existing, only a speed difference. To force a fresh local cache:
`python3 seo/refresh_coin_data.py` (takes the full 15-19 min, that's the whole point of running it
separately from every build).

## On-page standards

- **Title:** `{Coin} algo trading (paper) · zengtrade`: max ~60 chars
- **Meta description:** Honest paper trading on live prices; no live execution promise
- **H1:** One per page; include coin name + "paper" or "forward test"
- **CTA:** `/login?mode=signup&utm_source=site&utm_medium=organic&utm_campaign=coin_{slug}`

## Verification commands

```bash
./scripts/check-sitemap.sh
./scripts/check-funnel-ctas.sh
./scripts/check-seo-content.sh
curl -sI https://zengtrade.in/pricing/ | grep -i x-robots
```

## Metrics (`/admin`)

- `pageviews_7d`
- Signups with `utm_campaign=coin_*` (via event paths / GSC)

## Monthly GSC review (founder / SEO)

Run on the **first Monday** of each month after property is verified.

| Step | Action |
|------|--------|
| 1 | Open [Search Console](https://search.google.com/search-console) → `https://zengtrade.in` |
| 2 | **Performance** → last 28 days → export top 20 queries + pages |
| 3 | Note impressions/clicks for `/`, `/pricing/`, `/how-it-works/`, top 3 coin pages |
| 4 | **Indexing** → confirm sitemap `https://zengtrade.in/sitemap.xml`: 0 critical errors |
| 5 | **URL inspection** → request indexing for any new coin page or major copy change |
| 6 | Log findings in `docs/GROWTH_DASHBOARD.md` under **SEO** for that month |

Automated preflight (no GSC API required):

```bash
./scripts/check-sitemap.sh
./scripts/check-funnel-ctas.sh      # includes home_coins, signup_coins, paper_loop_coins
./scripts/check-seo-content.sh      # SoftwareApplication + WebSite + FAQPage + HowTo
./scripts/guide-monthly-gsc-review.sh   # founder monthly checklist
```

**Partial activation (worker offline):** honest organic copy in `docs/content/WEEKLY_PROOF.md` § Partial: no closed-trade claims until `./scripts/check-worker.sh` is green.

**KPI targets (30d):** 500 organic sessions/week · coin landing CTR from GSC · signups with `utm_campaign=coin_*` or `signup_coins`.

## Do not

- Index staging or `/ops/*` (should stay `noindex`)
- Duplicate meta across coin pages
