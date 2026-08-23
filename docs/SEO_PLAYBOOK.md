# SEO Playbook — zengtrade

Owner: **SEO Manager autopilot** (`.cursor/autopilot/seo.md`)

## Weekly rhythm

| Day | Task |
|-----|------|
| Mon | Run `./scripts/check-sitemap.sh` + `check-funnel-ctas.sh` + `check-seo-content.sh` on production |
| Wed | GSC: impressions/clicks for top 5 URLs (manual until API wired) |
| Fri | One pSEO or on-page improvement; rebuild landing if needed |

## GSC setup (founder once)

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

## Do not

- Index staging or `/ops/*` (should stay `noindex`)
- Duplicate meta across coin pages
