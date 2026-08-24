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
- `https://zengtrade.in/coins/` (hub)
- `https://zengtrade.in/login?mode=signup`

Organic UTMs to track in `/admin`: `home_coins`, `pricing_coins`, `pricing_pro`, `pricing_elite`, `coins_hub_pro`, `coin_{slug}_pro`, `signup_coins`, `signup_nudge_coins`, `deploy_success_coins`, `paper_loop_coins`.

`checkout_click` path suffixes (Pro upgrade intent): `free_limit_upgrade` (2nd deploy blocked), `deploy_success_pro` (post-deploy upsell), `forward_empty_pro` (Forward Test empty state).

**Partial proof posts** (worker offline): `docs/content/WEEKLY_PROOF.md` § Partial — no closed-trade claims.

## 4. Weekly CBO review

| Report | Action |
|--------|--------|
| Performance → Queries | Add content for top impressions, low CTR |
| Pages | Fix any "Crawled - not indexed" |
| Core Web Vitals | Keep landing static (already fast) |

Monthly deep review: `docs/SEO_PLAYBOOK.md` § Monthly GSC review.

## 5. Founder completion log (manual)

Tick when done — log date in `docs/GROWTH_DASHBOARD.md` under **CBO**:

- [ ] **Property verified** — `https://zengtrade.in` in [Search Console](https://search.google.com/search-console)
- [ ] **Sitemap submitted** — `https://zengtrade.in/sitemap.xml` (Indexing → Sitemaps)
- [ ] **Priority URLs requested** — home, pricing, how-it-works, top 3 coin pages, signup
- [ ] **Baseline screenshot** — Performance tab (28d) saved for week-over-week compare

Preflight (automated): `./scripts/check-gsc-ready.sh` · Founder guide: `./scripts/guide-gsc-founder.sh` · https://zengtrade.in/ops/gsc

**Parallel first Pro MRR (no worker):** optional deploy-first trust path — `/dashboard` deploy → View evidence → `/app#forward` → `/ops/billing` checkout → confirm `/admin` Paying ≥ 1.

Do **not** publish forward P&L proof posts until `./scripts/check-worker.sh` is green.

## 6. Coin SEO scale

```bash
pip install requests
python3 seo/generate.py        # 5 coins prototype
python3 seo/generate.py --all  # full set (when ready)
```

Coin pages are also built live in `deploy/landing/build.py` via Binance API during CI deploy.
