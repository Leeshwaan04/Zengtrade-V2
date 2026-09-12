"""content/tracks.py - three learning-path hub pages over content that already exists.

Founder direction (2026-09-12, session 220): help a DIY user understand "crypto investing,
trading and algo or automated trading" better, in that order of sophistication, because the
simpler that journey is, the higher conversion and retention gets, with zero human onboarding.

This module invents no new definitions and no new articles. It is a pure editorial regrouping
of content/glossary.py's 58 real terms and content/articles.py's real /learn/ articles into three
tracks: Investing (asset-class literacy, before any strategy matters) -> Trading (active,
rule-based decisions) -> Algo Studio (systematizing a trusted rule into something that runs
without you - zengtrade's own product). A term can matter to more than one track in real life;
each is placed in the track where a reader most needs it first, and the `related` cross-links
already on every glossary page carry a reader sideways from there.

TRACKS is a flat list of dicts: {slug, label, eyebrow, h1, sub, intro_html, term_slugs,
article_slugs, next_slug, next_label, next_line, cta_primary}. Order matters - it IS the
sophistication ladder, and drives the "next track" CTA at the bottom of each page.
"""
import html
import json

SITE = "https://zengtrade.in"

TRACKS_CSS = """
.track-card{position:relative}
.track-eyebrow{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--accent-d);margin-bottom:2px}
.track-ladder{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.track-step{font-size:12.5px;font-weight:600;color:var(--slate);background:var(--surface);border:1px solid var(--line);border-radius:100px;padding:5px 12px;text-decoration:none}
.track-step.on{color:var(--accent-d);border-color:var(--accent-line);background:var(--accent-soft)}
"""

TRACKS = [
    {
        "slug": "investing",
        "label": "Investing",
        "eyebrow": "start here",
        "h1": "Crypto investing, before you trade anything",
        "sub": "What crypto actually is as an asset, and the handful of ideas that decide whether "
               "you're prepared for it, before any strategy or automation is relevant.",
        "intro_html": (
            "<p>Crypto is a genuinely new, volatile asset class, and most of what determines "
            "whether you're prepared for that has nothing to do with charts or strategies yet. "
            "It's things like how big and liquid a coin actually is, what a bull or bear market "
            "does to every position at once, and who actually controls your coins while you hold "
            "them. Get this right first, trading and automation come after.</p>"
        ),
        "term_slugs": ["market-capitalization", "liquidity", "bull-market", "bear-market",
                       "dollar-cost-averaging", "non-custodial-trading"],
        "article_slugs": ["is-zengtrade-custodial"],
        "next_slug": "trading", "next_label": "Trading",
        "next_line": "Ready to make active, rule-based decisions instead of just holding?",
        "cta_primary": False,
    },
    {
        "slug": "trading",
        "label": "Trading",
        "eyebrow": "make decisions",
        "h1": "Crypto trading: reading the chart, sizing the risk",
        "sub": "The indicators, market regimes, and risk mechanics that separate a rule-based "
               "decision from a reactive one, the largest track here because it's the largest "
               "part of actually trading.",
        "intro_html": (
            "<p>Once you understand what you're holding, trading is about making the same kind of "
            "decision consistently instead of reacting to whatever the chart is doing today: "
            "reading what an indicator is actually telling you, knowing which regime you're in "
            "(trending, mean-reverting, or choppy), and sizing and protecting every position the "
            "same way every time. Most of a trader's edge, or lack of one, lives in these "
            "mechanics, not in any single indicator.</p>"
        ),
        "term_slugs": [
            "rsi", "moving-average", "golden-cross-death-cross", "macd", "bollinger-bands",
            "z-score", "adx", "supertrend-indicator", "vwap", "volume-spike",
            "average-true-range-atr", "drawdown", "position-sizing", "kelly-criterion",
            "risk-per-trade", "stop-loss", "chandelier-exit",
            "market-regime", "choppy-market", "trend-following", "mean-reversion", "whipsaw",
            "breakout-trading", "opening-range-breakout", "nr7", "momentum-trading",
            "cross-sectional-momentum", "statistical-arbitrage", "scalping",
            "slippage", "round-trip-cost", "profit-factor", "win-rate", "expectancy",
            "limit-order", "market-order", "basis-points-bps", "cost-drag", "sharpe-ratio",
            "cagr", "perpetual-futures", "funding-rate",
        ],
        "article_slugs": ["bull-bear-choppy-position-sizing", "what-is-a-market-regime-in-crypto-trading"],
        "next_slug": "algo-studio", "next_label": "Algo Studio",
        "next_line": "Tired of manually applying the same rule every time the setup shows up?",
        "cta_primary": False,
    },
    {
        "slug": "algo-studio",
        "label": "Algo Studio",
        "eyebrow": "automate it",
        "h1": "Algo Studio: prove a rule, then let it run",
        "sub": "How zengtrade tests a strategy on real history, proves it forward on live prices "
               "before trusting it, and runs it inside guardrails a human usually skips under "
               "pressure. This track is the product, not just the theory.",
        "intro_html": (
            "<p>Algo Studio is where a trading rule you trust stops depending on you watching a "
            "screen. Every strategy here gets backtested on real history, proven forward on live "
            "Binance prices before it's trusted (paper first, always, never real money by default), "
            "and run inside guardrails, a Risk Governor, a Cost Gate, a Kill-Switch, that a person "
            "trading manually usually skips the moment it matters most. This isn't a signal "
            "service. It's a place to build, test, and prove a strategy honestly before it ever "
            "risks anything.</p>"
        ),
        "term_slugs": [
            "out-of-sample-testing", "backtesting", "paper-trading", "forward-testing",
            "cost-gate", "regime-engine", "risk-governor", "kill-switch", "go-live-bar",
            "three-key-safety",
        ],
        "article_slugs": ["backtest-vs-forward-test", "what-is-paper-trading-crypto",
                          "crypto-backtest-costs-fees-slippage-tds"],
        "next_slug": None, "next_label": None, "next_line": None,
        "cta_primary": True,
    },
]


def _terms_by_slug(all_terms):
    return {t["slug"]: t for t in all_terms}


def _articles_by_slug(all_articles):
    return {a["slug"]: a for a in all_articles}


def tracks_index_cards():
    """Three cards for the top of /learn/, the primary entry point into the ladder."""
    e = html.escape
    cards = "".join(
        f'<a class="home-card track-card" href="/learn/{e(t["slug"])}/">'
        f'<span class="track-eyebrow">{e(t["eyebrow"])}</span><b>{e(t["label"])}</b>'
        f'<span>{e(t["sub"])}</span></a>'
        for t in TRACKS
    )
    return f'<div class="lp-grid3">{cards}</div>'


def track_hub_schema(track, terms):
    crumb = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"},
        {"@type": "ListItem", "position": 2, "name": "Learn", "item": f"{SITE}/learn/"},
        {"@type": "ListItem", "position": 3, "name": track["label"], "item": f"{SITE}/learn/{track['slug']}/"}]}
    item_list = {"@context": "https://schema.org", "@type": "CollectionPage",
                 "name": track["h1"], "url": f"{SITE}/learn/{track['slug']}/",
                 "mainEntity": {"@type": "ItemList", "itemListElement": [
                     {"@type": "ListItem", "position": i + 1, "name": t["term"],
                      "url": f"{SITE}/learn/glossary/{t['slug']}/"}
                     for i, t in enumerate(terms)]}}
    return (f'<script type="application/ld+json">{json.dumps(crumb)}</script>'
            f'<script type="application/ld+json">{json.dumps(item_list)}</script>')


def track_parts(track, all_terms, all_articles):
    """(title, desc, canonical, main_html, extra_head) - same shape article_parts()/coin_parts()
    return, so build.py's emit() call site is identical for every content type."""
    e = html.escape
    by_slug = _terms_by_slug(all_terms)
    terms = [by_slug[s] for s in track["term_slugs"] if s in by_slug]
    art_by_slug = _articles_by_slug(all_articles)
    articles = [art_by_slug[s] for s in track["article_slugs"] if s in art_by_slug]

    canonical = f"{SITE}/learn/{track['slug']}/"
    title = f"{track['h1']} | zengtrade"

    term_cards = "".join(
        f'<a class="gl-term-card" href="/learn/glossary/{e(t["slug"])}/"><b>{e(t["term"])}</b>'
        f'<span>{e(t["short"])}</span></a>' for t in terms)
    article_cards = "".join(
        f'<a class="home-card" href="/learn/{e(a["slug"])}/"><b>{e(a["title"])}</b>'
        f'<span>{e(a["description"])}</span></a>' for a in articles)
    articles_block = (
        f'<div class="gl-hub-cat"><h2>Read next</h2><div class="lp-grid4">{article_cards}</div></div>'
        if article_cards else ""
    )

    if track["next_slug"]:
        next_block = (
            f'<blockquote><b>{e(track["next_line"])}</b><br>The {e(track["next_label"])} track picks '
            f'up from here. <a href="/learn/{e(track["next_slug"])}/">Continue to {e(track["next_label"])} &rarr;</a></blockquote>'
        )
    else:
        next_block = f"""<div class="lp-cta-row center" style="margin-top:24px">
      <a class="lp-cta primary" href="/login/?mode=signup&amp;utm_source=site&amp;utm_medium=organic&amp;utm_campaign=learn_track_{e(track['slug'])}">Open Algo Studio, start free</a>
      <a class="lp-cta ghost" href="/login/?mode=signup&amp;plan=pro&amp;utm_source=site&amp;utm_medium=organic&amp;utm_campaign=learn_track_{e(track['slug'])}_pro">Founding Pro $19/mo</a>
    </div>"""

    ladder = "".join(
        f'<a class="track-step{" on" if t["slug"] == track["slug"] else ""}" href="/learn/{e(t["slug"])}/">{i + 1}. {e(t["label"])}</a>'
        for i, t in enumerate(TRACKS)
    )

    main = f"""<main id="main">
  <section class="lp-hero" aria-labelledby="h-track">
    <div class="lp-wrap">
      <nav class="coin-crumb" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/learn/">Learn</a> &rsaquo; {e(track['label'])}</nav>
      <div class="lp-eyebrow"><span class="dot"></span> {e(track['eyebrow'])}</div>
      <h1 id="h-track" class="lp-h1">{e(track['h1'])}</h1>
      <p class="lp-sub">{e(track['sub'])}</p>
      <div class="track-ladder">{ladder}</div>
    </div>
  </section>
  <section class="lp-sec" aria-label="{e(track['label'])} track">
    <div class="lp-wrap article-body">
      {track['intro_html']}
      <div class="gl-hub-cat"><h2>{e(track['label'])} terms</h2><div class="gl-hub-grid">{term_cards}</div></div>
      {articles_block}
      {next_block}
      <p class="lp-fineprint">Educational content, not investment advice. zengtrade is paper-first and non-custodial.</p>
    </div>
  </section>
</main>"""
    return title, track["sub"], canonical, main, track_hub_schema(track, terms)
