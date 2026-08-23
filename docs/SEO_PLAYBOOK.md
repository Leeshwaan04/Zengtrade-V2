# SEO Playbook — zengtrade

Owner: **SEO Manager autopilot** (`.cursor/autopilot/seo.md`)

## Weekly rhythm

| Day | Task |
|-----|------|
| Mon | Run `./scripts/check-gsc-ready.sh` (sitemap + SEO + funnel CTAs + signup) on production |
| Wed | GSC: impressions/clicks for top 5 URLs (manual until API wired) |
| Fri | One pSEO or on-page improvement; rebuild landing if needed |

## GSC setup (founder once)

**Can run while worker is blocked** — indexing does not need paper trades. Proof posts should wait for P0.

1. [Add property](https://search.google.com/search-console) → `https://zengtrade.in`
2. Submit `https://zengtrade.in/sitemap.xml`
3. Request indexing: `/`, `/pricing/`, `/how-it-works/`, `/coins/bitcoin/`
4. Founder page: **https://zengtrade.in/ops/gsc**

## Coin pSEO pipeline

```bash
python3 seo/generate.py          # generate coin HTML
python3 deploy/landing/build.py  # merge into dist
./scripts/check-sitemap.sh       # verify URLs in production sitemap
```

Target coins (minimum 7): BTC, ETH, SOL, BNB, XRP, ADA, DOGE.

## On-page standards

- **Title:** `{Coin} algo trading (paper) · zengtrade` — max ~60 chars
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
| 4 | **Indexing** → confirm sitemap `https://zengtrade.in/sitemap.xml` — 0 critical errors |
| 5 | **URL inspection** → request indexing for any new coin page or major copy change |
| 6 | Log findings in `docs/GROWTH_DASHBOARD.md` under **SEO** for that month |

Automated preflight (no GSC API required):

```bash
./scripts/check-gsc-ready.sh
./scripts/check-sitemap.sh
./scripts/check-funnel-ctas.sh
./scripts/guide-monthly-gsc-review.sh   # founder monthly checklist
```

**KPI targets (30d):** 500 organic sessions/week · coin landing CTR from GSC · signups with `utm_campaign=coin_*`.

## Do not

- Index staging or `/ops/*` (should stay `noindex`)
- Duplicate meta across coin pages
