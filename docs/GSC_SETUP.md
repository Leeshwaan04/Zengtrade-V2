# Google Search Console — organic setup (CBO autopilot)

## 0. Parallel work (worker blocked)

GSC verification and sitemap submit **do not** require the paper worker. Run now:

- `./scripts/check-gsc-ready.sh` or https://zengtrade.in/ops/gsc
- `./scripts/check-parallel-growth.sh` — partial activation + billing + GSC in one command

Save forward-proof posts and r/algotrading draft until `./scripts/check-worker.sh` is green.

## 1. Verify domain

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add property: **URL prefix** `https://zengtrade.in`
3. Verification method (pick one):
   - **DNS TXT** record on Cloudflare/Hostinger (recommended if using custom domain)
   - **HTML file** upload to site root
   - **GitHub Pages** meta tag in `deploy/landing/build.py` `shell()` if needed

## 2. Submit sitemap

After deploy, submit:

```
https://zengtrade.in/sitemap.xml
```

Built automatically by `python3 deploy/landing/build.py` (home, how-it-works, pricing, coins/*).

Verify after deploy: `./scripts/check-gsc-ready.sh` (or `./scripts/check-sitemap.sh` + `./scripts/check-seo-content.sh`)

## 3. Request indexing (priority URLs)

- `https://zengtrade.in/`
- `https://zengtrade.in/pricing/`
- `https://zengtrade.in/how-it-works/`
- `https://zengtrade.in/coins/bitcoin/`
- `https://zengtrade.in/login?mode=signup`

## 4. Weekly CBO review

| Report | Action |
|--------|--------|
| Performance → Queries | Add content for top impressions, low CTR |
| Pages | Fix any "Crawled - not indexed" |
| Core Web Vitals | Keep landing static (already fast) |

## 5. Coin SEO scale

```bash
pip install requests
python3 seo/generate.py        # 5 coins prototype
python3 seo/generate.py --all  # full set (when ready)
```

Coin pages are also built live in `deploy/landing/build.py` via Binance API during CI deploy.
