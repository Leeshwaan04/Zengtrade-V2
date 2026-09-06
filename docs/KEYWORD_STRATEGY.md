# Keyword & Content Strategy: zengtrade

Owner: SEO Manager autopilot (`.cursor/autopilot/seo.md`) · companion to `docs/SEO_PLAYBOOK.md` and `docs/GSC_SETUP.md`

## Ground rules (read before editing any page's title/meta/H1)

- **No page targets a phrase another page already owns.** The table below is the source of
  truth; if a new page's natural title would duplicate an existing primary keyword, change the
  angle or fold it into the existing page instead of creating overlap.
- **Volumes here are intent classifications, not measured numbers.** This site has no paid
  keyword-research tool wired in, and fabricating search-volume figures would be worse than not
  having them. The real numbers live in **GSC → Performance** once the site has a few weeks of
  data (`docs/SEO_PLAYBOOK.md` § Monthly GSC review already has the process) — treat that as the
  actual measurement of whether a keyword choice below was right, and revise this doc from it.
- **Primary keyword = the phrase the title/H1/URL are built around. Secondary = phrases the body
  copy, FAQ, and alt text should naturally cover without forcing them.** A page should read as
  written for a human first; if a secondary keyword doesn't fit a sentence honestly, drop it.

---

## Site-wide keyword ownership map (cannibalization guardrail)

| Page | Primary keyword (this page, and ONLY this page, targets it) | Intent |
|---|---|---|
| `/` | `regime-aware crypto trading strategies` / `crypto algo trading platform` | Commercial investigation — evaluating platforms |
| `/how-it-works/` | `how does regime-based crypto trading work` | Informational — understanding the mechanism before trusting it |
| `/pricing/` | `zengtrade pricing` / `crypto paper trading pro plan` | Transactional — ready to compare plans |
| `/coins/` (hub) | `crypto trading strategies by coin` | Navigational/informational — browsing by coin, not yet coin-specific |
| `/coins/{slug}/` × 150 | `{coin name} trading strategy` (e.g. `bitcoin trading strategy`) | Commercial investigation — researching a systematic approach to ONE coin |
| `/login` | (no organic keyword target — conversion page, arrives via CTA only) | Transactional |

The riskiest overlap is **home vs. the coins hub vs. individual coin pages** — all three could
drift toward "crypto trading strategies." They're kept distinct on purpose:
- Home owns the **unbranded, platform-level** head term (why zengtrade, not why crypto strategies).
- The hub owns the **browsing/comparison** intent (which coin, not why this platform).
- Each coin page owns the **single-coin long-tail** (this coin specifically), never the head term.

If you ever add a page like "best crypto trading strategies 2026," it competes directly with home
— don't ship it without either merging the angle into home or deliberately retiring home's claim
on that phrase.

---

## Marketing pages

### Home (`/`)
- **Primary:** `regime-aware crypto trading strategies`
- **Secondary:** `crypto algo trading platform`, `paper trade crypto strategies`, `bull bear regime trading`
- **Intent:** Commercial investigation. Visitor already knows algo/systematic trading exists and is comparing platforms or approaches.
- **Current title/meta:** `zengtrade: Regime-Aware Crypto Trading Strategies` (49 chars) / 134-char description — both fixed this session to fit SERP display width.
- **H1:** already coin-agnostic and regime-forward ("The market has moods. The engine reads them.") — good, matches intent, don't force the raw keyword phrase into it verbatim; the supporting H2s already carry `paper-trade`, `by coin`, `prove the edge`.
- **Internal links out:** to `/coins/` (hub), `/pricing/`, `/how-it-works/` — already present in the mega-nav; no change needed.

### How it works (`/how-it-works/`)
- **Primary:** `how does regime-based crypto trading work`
- **Secondary:** `bull bear choppy regime detection`, `honest crypto backtest costs`, `crypto risk governor`
- **Intent:** Informational, **trust-building** — this page's job is to convert skepticism into a signup, not to rank for a head term on its own. Its SEO value is mostly in supporting home's authority via internal links and in capturing "how does X work" long-tail informational queries.
- **Current title/meta:** already tight (41/127 chars).
- **Gap:** the HowTo schema present (verified live) targets "paper trade a crypto strategy," which is a slightly different phrase than the page's own title target — not wrong, but worth aligning if this page's title ever changes.

### Pricing (`/pricing/`)
- **Primary:** `zengtrade pricing`
- **Secondary:** `crypto paper trading free plan`, `crypto algo strategy subscription`, `$19/mo trading bot`
- **Intent:** Transactional. Someone here is comparing cost, not learning what the product is.
- **Current title/meta:** already tight (44/132 chars) and FAQPage schema is live (verified) — good.

### Coins hub (`/coins/`)
- **Primary:** `crypto trading strategies by coin`
- **Secondary:** `list of crypto strategies`, `[coin] vs [coin] trading strategy`
- **Intent:** Browsing/comparison across coins, not committed to one yet.
- **Shipped (session 219):** grouped into 11 category sections (Majors, Layer-1s, Layer-2s, DeFi, Payments, Infrastructure & Oracles, AI & Data, Gaming & Metaverse, Meme Coins, Privacy, More Coins), each its own `<h2>` + intro sentence — each section can now independently rank for `[category] crypto trading strategies` long-tail (e.g. "defi trading strategies," "meme coin trading bot") without a new page. `CATEGORY_MAP` coverage expanded from ~60 to ~155 symbols in the same pass (fallback bucket dropped from 90/150 to 12/150) so "More Coins" stays a genuinely small catch-all, not most of the page.

---

## Coin page template (the formula behind all 150 pages)

Every `/coins/{slug}/` page is generated from the same formula in `seo/generate.py`, so the
strategy is defined once here and applies mechanically to all 150 — a per-page write-up for each
would just restate this with the name swapped.

- **Primary keyword:** `{coin name} trading strategy` (title: `{Name} ({SYM}) Trading Strategies | zengtrade`)
- **Secondary keywords (all present in body copy/FAQ already):** `{coin} backtest`, `paper trade {coin}`, `{coin} algo trading`, `{coin} market regime`, `{SYM} trading strategy`
- **Category-specific long-tail** (from `CATEGORY_ANGLE`, genuinely different copy per category, not the same paragraph reworded — this is what keeps 150 pages from reading as templated duplicates to Google):
  - major → `bitcoin trend following strategy`
  - layer-1 → `solana high beta trading strategy`
  - defi → `uniswap mean reversion strategy`
  - meme → `shiba inu volatility trading bot`
  - payments → `xrp range trading strategy`
  - infra / ai / gaming / privacy / exchange-token / altcoin → analogous, see `CATEGORY_ANGLE` dict
- **Intent:** Commercial investigation, coin-specific. NOT "buy {coin}" transactional intent (that's exchange territory, not this product's job) and NOT pure price-lookup intent (that's CoinMarketCap/CoinGecko's job) — the wedge is "systematic strategy for this specific coin," which is a real, underserved long-tail that exchanges and price-trackers don't target.
- **Internal linking:** hub → coin page (all 150 linked from `/coins/`), coin page → 4 related coins (same-category preferred, verified in `coin_parts()`'s `related` logic added this session), coin page → signup/Pro CTA with a `coin_{slug}` UTM (verified live, matches `check-funnel-ctas.sh`).
- **Duplicate-content guardrail already in place:** name, symbol, live price/regime-read, and category angle are injected per coin, so no two of the 150 pages share body copy. Verified: zero slug collisions across the current roster (checked when the CSV was generated).

### Worked examples (concrete, not hypothetical)

| Coin | Primary | Category angle keyword | Why this ≠ another page |
|---|---|---|---|
| Bitcoin | `bitcoin trading strategy` | `bitcoin trend following` (major) | Regime-leader framing; only BTC/ETH/BNB get this angle |
| Solana | `solana trading strategy` | `solana high beta strategy` (layer-1) | Explicitly about bigger swings than majors — different claim than BTC's page |
| Shiba Inu | `shiba inu trading strategy` | `shiba inu volatility trading bot` (meme) | Social-momentum framing, small-size/fast-exit angle — opposite risk posture from Bitcoin's page |
| Uniswap | `uniswap trading strategy` | `uniswap mean reversion strategy` (defi) | On-chain-activity correlation framing, reversion not trend |

---

## `/learn/` educational articles (shipped session 219)

Closes gap #1 below. Six hand-authored markdown articles (`content/articles/*.md`, rendered by
`content/articles.py` through the same `shell()` every other page uses), reachable from the
existing "Learn" mega-nav dropdown (`/learn/` added as a new top item, the dropdown's 3 pre-existing
how-it-works anchors left untouched) and from `/learn/` itself. Each targets a distinct definitional
query none of the coin pages or marketing FAQs already own:

| Article | Primary keyword | Intent |
|---|---|---|
| `/learn/what-is-a-market-regime-in-crypto-trading/` | `what is a market regime in crypto trading` | Informational — canonical deep-dive; `/how-it-works/` should eventually link out to this instead of re-explaining inline |
| `/learn/what-is-paper-trading-crypto/` | `what is paper trading crypto` | Informational |
| `/learn/crypto-backtest-costs-fees-slippage-tds/` | `crypto backtest costs fees slippage` | Informational — **highest-leverage of the six**: all 150 coin pages' "Honest about the cost" paragraph should link here as the canonical deep-dive, giving every coin page a real, substantive internal link instead of a dead end |
| `/learn/bull-bear-choppy-position-sizing/` | `position sizing by market regime` | Informational |
| `/learn/backtest-vs-forward-test/` | `backtest vs forward test` | Informational — repurposes `MARKETING_PLAYBOOK.md`'s never-built "week 2" LinkedIn-only explainer into the canonical on-site version |
| `/learn/is-zengtrade-custodial/` | `is zengtrade custodial` | Informational/trust — closes former gap #4 (no platform-level "is this custodial" page) |

**UTM convention:** `utm_campaign=learn_{slug}` / `_pro` on each article's signup/Pro CTA, same
shape as `coin_{slug}`, captured automatically by the existing pageview beacon — see
`docs/MARKETING_PLAYBOOK.md`'s UTM table.

**Shipped:** all 150 coin pages' "Honest about the cost" paragraph now links to this article
(`seo/generate.py`'s `coin_parts()`).

## Content gaps and opportunities (things that don't exist yet)

1. ~~No on-site educational/blog content~~ — **closed session 219**, see `/learn/` section above.
2. **No comparison content.** No "zengtrade vs. [X]" or "best crypto paper trading platforms"
   style page. Deliberately still out of scope: for a solo-founder site with no legal/accuracy-
   maintenance process for claims about named competitors, the risk is asymmetric. If this intent
   is worth targeting later, the lower-risk version is "how to evaluate a paper-trading platform"
   (same intent, no claims about anyone by name) — revisit only if GSC shows real comparison-intent
   impressions.
3. ~~Coins hub isn't segmented by category~~ — **closed session 219**, see above.
4. ~~No FAQ/glossary hub independent of individual pages~~ — **closed session 219** via `/learn/is-zengtrade-custodial/`; the broader "platform-level FAQ hub" idea is otherwise superseded by `/learn/` itself.

## Measurement (how to know if this strategy is working)

Don't guess from this document, check `/admin` and GSC monthly per `docs/SEO_PLAYBOOK.md` §
Monthly GSC review. Specifically watch:
- Which coin pages get impressions but near-zero clicks (title/meta not compelling for the query Google is showing it for, revise that page's copy, not the whole template).
- Whether the hub or home start showing up for coin-specific queries (a cannibalization signal — a coin page might need a more targeted title if the hub is winning its query instead).
- `signup` events with `utm_campaign=coin_*` in `/admin`, this is the real conversion signal the whole pSEO investment is being measured against.
