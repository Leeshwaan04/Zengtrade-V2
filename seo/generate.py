#!/usr/bin/env python3
"""zengtrade programmatic-SEO generator, one DATA-RICH page per coin (the quality-first pSEO play).

Each page is genuinely unique: live price + 24h/7d stats, a 30-day SVG sparkline, a
regime "read" computed from real daily candles (trend vs range), category-specific strategy
guidance, an honest cost note, an FAQ, and hub-and-spoke internal links, with full per-page SEO
(title/description/canonical/OG + BreadcrumbList + FAQPage + FinancialProduct schema) and a sitemap.

NOT a thin-content mill: the data + the regime read + the category guidance vary per coin, so no
two pages are templated duplicates (which Google penalises as "scaled content abuse").

This module is a content library, not a standalone script: `COINS` is built dynamically at import
time (top ~150 coins by live CoinGecko market cap, cross-checked against live Binance USDT-spot
tradability - see build_coin_universe()), so there's no separate "prototype vs --all" step. Run
the whole site (which imports this module) with:  python3 deploy/landing/build.py
"""
from __future__ import annotations
import html, json, os, sys, time

try:
    import requests
except ImportError:
    print("pip install requests"); sys.exit(1)

BASE = "https://data-api.binance.vision"
SITE = "https://zengtrade.in"

# Curated category map for well-known symbols (drives which CATEGORY_ANGLE paragraph a coin
# gets). Anything not listed falls back to DEFAULT_CATEGORY, still personalised with its own
# live data/regime read, so a fallback page is still unique, just with generic-altcoin framing.
CATEGORY_MAP = {
    "BTC": "major", "ETH": "major", "BNB": "major",
    "SOL": "layer-1", "ADA": "layer-1", "AVAX": "layer-1", "DOT": "layer-1", "NEAR": "layer-1",
    "ATOM": "layer-1", "APT": "layer-1", "SUI": "layer-1", "ICP": "layer-1", "ALGO": "layer-1",
    "TON": "layer-1", "SEI": "layer-1", "INJ": "layer-1", "TIA": "layer-1", "HBAR": "layer-1",
    "EGLD": "layer-1", "FTM": "layer-1", "KAS": "layer-1", "FLOW": "layer-1", "MINA": "layer-1",
    "MATIC": "layer-2", "ARB": "layer-2", "OP": "layer-2", "IMX": "layer-2", "STRK": "layer-2",
    "MANTA": "layer-2", "METIS": "layer-2", "ZK": "layer-2",
    "UNI": "defi", "AAVE": "defi", "MKR": "defi", "CRV": "defi", "LDO": "defi", "COMP": "defi",
    "SNX": "defi", "SUSHI": "defi", "DYDX": "defi", "CAKE": "defi", "GMX": "defi", "RUNE": "defi",
    "PENDLE": "defi", "JUP": "defi",
    "SHIB": "meme", "PEPE": "meme", "FLOKI": "meme", "BONK": "meme", "WIF": "meme",
    "XRP": "payments", "XLM": "payments", "DOGE": "payments", "LTC": "payments", "BCH": "payments",
    "LINK": "infra", "GRT": "infra", "FIL": "infra", "AR": "infra", "STORJ": "infra", "BAND": "infra",
    "FET": "ai", "RENDER": "ai", "AGIX": "ai", "TAO": "ai", "WLD": "ai", "OCEAN": "ai",
    "SAND": "gaming", "MANA": "gaming", "AXS": "gaming", "GALA": "gaming", "ENJ": "gaming", "ILV": "gaming",
    "XMR": "privacy", "ZEC": "privacy", "DASH": "privacy",
    "OKB": "exchange-token", "CRO": "exchange-token", "LEO": "exchange-token",
    "GT": "exchange-token", "KCS": "exchange-token",
    # Expanded session 219 after live-checking the actual top-150 roster (was 90/150 falling back
    # to the generic "altcoin" bucket - see docs/KEYWORD_STRATEGY.md). Classified from each coin's
    # real, publicly-known purpose; genuinely ambiguous/unfamiliar ones are left in DEFAULT_CATEGORY
    # on purpose rather than guessed, this list needs revisiting each time the roster shifts.
    "TRX": "layer-1", "GRAM": "layer-1", "ETC": "layer-1", "VET": "layer-1", "STX": "layer-2",
    "DCR": "layer-1", "LUNC": "layer-1", "XTZ": "layer-1", "CFX": "layer-1", "XPL": "layer-1",
    "KAIA": "layer-1", "IOTA": "layer-1", "NEO": "layer-1", "S": "layer-1", "DGB": "layer-1",
    "QTUM": "layer-1", "KSM": "layer-1", "NIGHT": "layer-1",
    "POL": "layer-2",
    "ASTER": "defi", "ONDO": "defi", "WLFI": "defi", "MORPHO": "defi", "ENA": "defi", "SKY": "defi",
    "JST": "defi", "NEXO": "defi", "ETHFI": "defi", "AERO": "defi", "FF": "defi", "RAY": "defi",
    "SUN": "defi", "SYRUP": "defi", "JTO": "defi", "CVX": "defi", "EIGEN": "defi", "PROM": "defi",
    "PLUME": "defi", "ZRX": "defi", "RSR": "defi", "ORCA": "defi", "YFI": "defi", "COW": "defi",
    "1INCH": "defi", "MET": "defi", "KMNO": "defi",
    "PUMP": "meme", "TRUMP": "meme", "PENGU": "meme", "AI": "meme", "MARSCOIN": "meme",
    "BANANAS31": "meme",
    "XEC": "payments",
    "QNT": "infra", "PYTH": "infra", "ZRO": "infra", "GNO": "infra", "ENS": "infra", "TWT": "infra",
    "GLM": "infra", "BAT": "infra", "RIF": "infra", "GAS": "infra", "SFP": "infra", "JASMY": "infra",
    "VIRTUAL": "ai", "KAITO": "ai", "ARKM": "ai", "SENT": "ai",
    "CHZ": "gaming", "APE": "gaming", "SUPER": "gaming",
    "ZEN": "privacy", "ZAMA": "privacy",
}
DEFAULT_CATEGORY = "altcoin"

CATEGORY_ANGLE = {
    "major": "As a large-cap major, {name} tends to lead the market's regime. zengtrade's engine reads {sym}'s own trend against the broader BTC-led regime and only deploys directional strategies when the tape confirms, otherwise it stands down to cash.",
    "layer-1": "{name} is a higher-beta layer-1: it can trend hard in a bull regime and bleed fast in a bear. The engine sizes {sym} smaller and leans on the chandelier/trailing exit so a strong run is captured but a reversal is cut early.",
    "layer-2": "{name} often trades with high beta to its host layer-1 and can gap on unlock or listing-driven news. The engine treats those gaps cautiously, requiring a confirmed trend continuation rather than chasing the initial spike.",
    "defi": "{name} tends to track on-chain protocol activity and de-risks hard in broad market stress. The engine favours reversion entries after outsized single-day moves in {sym} and stands directional bets down in high-vol regimes.",
    "meme": "{name} is driven by social momentum more than fundamentals and can move double digits intraday. The engine keeps {sym} position sizing small, demands strong confirmation before entering, and exits fast on ATR-based stops rather than holding through drawdown.",
    "payments": "{name} often ranges for long stretches then moves in bursts. zengtrade favours mean-reversion and breakout confirmation on {sym} in choppy regimes, and stands directional strategies down until a real trend prints.",
    "infra": "{name} is an infrastructure/oracle-layer token whose moves often lag broader market shifts by a cycle. The engine waits for {sym}'s own trend to confirm independently rather than assuming it mirrors BTC or ETH.",
    "ai": "{name} trades on narrative and funding-cycle sentiment as much as usage data, with sharp reversals when the theme rotates. The engine requires trend confirmation on {sym} and avoids sizing up into a single-narrative spike.",
    "gaming": "{name} correlates with gaming/metaverse narrative cycles and token-emission schedules more than broad market regime. The engine sizes {sym} conservatively and favours confirmed breakouts over anticipating a narrative turn.",
    "privacy": "{name} tends to have thinner liquidity and episodic, regulation-driven volatility. The engine sizes {sym} conservatively and requires wider confirmation before committing capital.",
    "exchange-token": "{name} is an exchange-native token whose price often reflects that exchange's own volume and buyback cadence more than the broader crypto regime. The engine reads {sym}'s own trend independently before deploying.",
    "altcoin": "{name} doesn't yet have enough of a distinct behavioural profile in zengtrade's playbook to get a specialised angle, so the engine treats {sym} with its standard regime-aware rules: confirm the trend, size conservatively, and stand down in choppy or high-vol conditions.",
}

# Display label + one-sentence intro per category section on the /coins/ hub. Seeded from the same
# personality CATEGORY_ANGLE already establishes per coin page (one source of truth for how
# zengtrade frames each category), reworded as a section-level intro rather than per-coin copy.
CATEGORY_LABEL = {
    "major": "Majors", "layer-1": "Layer-1s", "layer-2": "Layer-2s", "defi": "DeFi",
    "meme": "Meme Coins", "payments": "Payments", "infra": "Infrastructure & Oracles",
    "ai": "AI & Data", "gaming": "Gaming & Metaverse", "privacy": "Privacy",
    "exchange-token": "Exchange Tokens", "altcoin": "More Coins",
}
CATEGORY_HUB_INTRO = {
    "major": "The large-caps that tend to lead the market's regime - the engine reads their trend against the broader tape before it commits.",
    "layer-1": "Higher-beta base-layer chains: bigger trends in a bull regime, faster drawdowns in a bear, sized and exited accordingly.",
    "layer-2": "Scaling chains that often gap on unlock or listing news - the engine waits for a confirmed continuation, not the initial spike.",
    "defi": "Protocol tokens that track on-chain activity and de-risk hard in market stress - reversion-favoured, sized down in high-vol regimes.",
    "meme": "Social-momentum coins that can move double digits intraday - small size, strong confirmation required, fast ATR-based exits.",
    "payments": "Coins that range for long stretches then move in bursts - mean-reversion and breakout confirmation over chasing a trend.",
    "infra": "Oracle, naming, and infrastructure-layer tokens whose moves often lag broader shifts by a cycle - the engine waits for their own trend to confirm.",
    "ai": "Narrative- and funding-cycle-driven tokens - trend confirmation required before sizing into a single-narrative spike.",
    "gaming": "Gaming and metaverse-linked tokens tied to narrative cycles and emission schedules more than broad market regime.",
    "privacy": "Thinner-liquidity coins with episodic, regulation-driven volatility - sized conservatively, wider confirmation required.",
    "exchange-token": "Exchange-native tokens whose price often reflects that exchange's own volume more than the broader crypto regime.",
    "altcoin": "Coins zengtrade doesn't yet have a specialised playbook angle for - still live prices, a real regime read, and the standard regime-aware rules.",
}


def get(path, **params):
    r = requests.get(BASE + path, params=params, timeout=20)
    r.raise_for_status()
    return r.json()


# Coin universe: the STABLE_BASES below are pegged assets (or gold-backed) that don't have a
# "regime" in the sense the engine reads one, so a strategies/regime-read page for them would be
# empty/misleading content, not a genuine one, they're excluded rather than padded in.
STABLE_BASES = {
    "USDT", "USDC", "FDUSD", "USD1", "DAI", "TUSD", "BUSD", "PYUSD", "USDP", "GUSD",
    "EUR", "EURI", "AEUR", "USDE", "USDS", "PAXG", "XAUT",
    # Added session 219: these slipped through into the live top-150 roster despite being
    # $1-pegged (RLUSD, BFUSD, "United Stables", legacy Frax Dollar, USD.AI) - same reasoning as
    # the rest of this set, a "trading strategy" page for a stable-value asset is empty content.
    "RLUSD", "BFUSD", "U", "FRAX", "CHIP",
}

# Not cryptocurrencies at all - tokenized wrappers for traditional-market assets (e.g. a Binance
# "bStock" tokenized equity). zengtrade is a crypto-only product (see README/CRYPTO_PRODUCT.md);
# a regime-read/strategy page for a tokenized stock proxy would be a category error, not just thin
# content, so these are excluded even though they trade against USDT on Binance spot.
NON_CRYPTO_BASES = {"CRCLB"}

# CoinGecko's `id` field is usually a fine slug (bitcoin, ethereum, solana, ...), but for a few
# well-known coins it's the project/company name rather than the ticker people actually search for
# and type (binancecoin, ripple), overriding those keeps the URL matching what users expect and
# what was already live under the original 7-coin prototype, rather than silently changing it.
SLUG_OVERRIDE = {"BNB": "bnb", "XRP": "xrp"}


def build_coin_universe(n=150):
    """Real top-N coins ranked by CoinGecko market cap (stable, hard to game), filtered to
    whichever of those are actually tradable on Binance USDT spot right now (so every page still
    backs its stats with live Binance data). Market cap, not 24h volume, drives the ranking on
    purpose: a single pump-of-the-day microcap can spike into a raw-volume top-150 for one day
    (an earlier version of this picked up things like MARSCOIN and MUBARAK that way), whereas
    market cap tracks what people actually recognise and search for. Dynamic, not hardcoded, so
    the roster stays current as rankings shift over time."""
    info = get("/api/v3/exchangeInfo")
    tradable = {
        s["baseAsset"] for s in info["symbols"]
        if s["status"] == "TRADING" and s.get("isSpotTradingAllowed")
        and s["quoteAsset"] == "USDT" and s["baseAsset"] not in STABLE_BASES
        and s["baseAsset"] not in NON_CRYPTO_BASES
    }
    universe, seen = {}, set()
    for page in (1, 2, 3):
        if len(universe) >= n:
            break
        try:
            rows = requests.get(
                "https://api.coingecko.com/api/v3/coins/markets",
                params={"vs_currency": "usd", "order": "market_cap_desc", "per_page": 250, "page": page},
                timeout=20,
            ).json()
        except Exception as ex:
            print("  ! CoinGecko market-cap lookup failed on page", page, ":", ex)
            break
        if not isinstance(rows, list) or not rows:
            break
        for r in rows:
            sym = str(r.get("symbol", "")).upper()
            if not sym or sym in seen or sym not in tradable:
                continue
            seen.add(sym)
            slug = SLUG_OVERRIDE.get(sym) or r.get("id") or sym.lower()
            universe[sym] = (r.get("name") or sym, slug, CATEGORY_MAP.get(sym, DEFAULT_CATEGORY))
            if len(universe) >= n:
                break
    return universe


try:
    COINS = build_coin_universe(150)
    if not COINS:
        raise RuntimeError("empty coin universe")
except Exception as ex:
    print("  ! live coin universe fetch failed, falling back to the 7-coin prototype set:", ex)
    COINS = {
        "BTC": ("Bitcoin", "bitcoin", "major"),
        "ETH": ("Ethereum", "ethereum", "major"),
        "SOL": ("Solana", "solana", "layer-1"),
        "BNB": ("BNB", "bnb", "major"),
        "XRP": ("XRP", "xrp", "payments"),
        "ADA": ("Cardano", "cardano", "layer-1"),
        "DOGE": ("Dogecoin", "dogecoin", "payments"),
    }


def sparkline(closes, w=560, h=90):
    if len(closes) < 2:
        return ""
    lo, hi = min(closes), max(closes)
    rng = (hi - lo) or 1
    pts = " ".join(f"{i/(len(closes)-1)*w:.1f},{h-(c-lo)/rng*h:.1f}" for i, c in enumerate(closes))
    up = closes[-1] >= closes[0]
    col = "#00ab4e" if up else "#e0483d"
    area = f"0,{h} {pts} {w},{h}"
    return (f'<svg class="spark" viewBox="0 0 {w} {h}" preserveAspectRatio="none" role="img" '
            f'aria-label="30-day price trend">'
            f'<polygon points="{area}" fill="{col}" opacity="0.08"/>'
            f'<polyline points="{pts}" fill="none" stroke="{col}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>')


def regime_read(closes):
    """Honest, data-driven regime tilt from 30 daily closes: trend strength vs range."""
    if len(closes) < 20:
        return ("Neutral", "Not enough recent data to call a regime, the engine would gather evidence before deploying.")
    first, last = closes[0], closes[-1]
    chg = (last / first - 1) * 100
    # simple trend/range: net move vs the path length (choppiness)
    path = sum(abs(closes[i] - closes[i-1]) for i in range(1, len(closes)))
    directness = abs(last - first) / (path or 1)   # 1 = straight line, ~0 = choppy
    if chg > 8 and directness > 0.35:
        return ("Bull", f"{sym_hint} has trended up ~{chg:.0f}% over 30 days with a clean path, a Bull read. The engine would run breakout/trend strategies here, trailing the winner.")
    if chg < -8 and directness > 0.35:
        return ("Bear", f"Down ~{abs(chg):.0f}% over 30 days in a directed move, a Bear read. Directional longs stand down to cash; only market-neutral / short-premium sleeves stay on.")
    return ("Neutral/Choppy", f"Net {chg:+.0f}% over 30 days but a choppy path, a ranging read. The engine favours mean-reversion and waits for a real trend before committing.")


sym_hint = "This coin"


# ---- coin CSS: coin-specific bits only; everything else reuses the shared site.css --------
# (lp-wrap, lp-sec, lp-hero, lp-eyebrow, lp-h1/h2, lp-sub, hl, home-card, faq, lp-cta come
#  from the marketing design system, so coin pages inherit the exact same look + typography.)
COIN_CSS = """
/* ---- per-coin pSEO pages (share the marketing design system) ---- */
.coin-crumb{font-size:12.5px;color:var(--slate);margin:0 0 14px}
.coin-crumb a{color:var(--slate);text-decoration:none}
.coin-crumb a:hover{color:var(--navy)}
.coin-price{display:flex;align-items:baseline;gap:12px;margin:10px 0 4px;flex-wrap:wrap}
.coin-price b{font:800 34px/1 var(--mono);color:var(--navy)}
.coin-chg{font:700 15px/1 var(--mono)}
.coin-chg.up{color:var(--green)}.coin-chg.down{color:var(--red)}
.spark{width:100%;height:96px;display:block;margin:14px 0;border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:10px}
.coin-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin:16px 0}
.coin-stat{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px;min-width:0}
.coin-stat span{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);font-weight:700}
.coin-stat b{display:block;font:700 17px/1.3 var(--mono);margin-top:4px;overflow-wrap:anywhere;color:var(--navy)}
.coin-stat b.up{color:var(--green)}.coin-stat b.down{color:var(--red)}
.coin-asof{font-size:11.5px;color:var(--slate);margin:2px 0 0}
.coin-regime{display:flex;gap:12px;align-items:flex-start;background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--green);border-radius:14px;padding:16px;margin:0 0 10px}
.coin-regime b{color:var(--navy)}.coin-regime span{color:var(--slate)}
a.home-card{text-decoration:none}
.coin-hub-lead{color:var(--slate);max-width:60ch}
@media(max-width:600px){.coin-stats{grid-template-columns:repeat(2,1fr)}.coin-price b{font-size:27px}}
"""


def coin_parts(sym, name, slug, cat, tk, closes):
    """Return (title, desc, canonical, main_html, extra_head) for a coin page.
    main_html is a <main> that drops straight into the shared shell(); extra_head is the
    coin's JSON-LD (BreadcrumbList + FAQPage). All chrome/footer/typography come from shell()."""
    global sym_hint
    sym_hint = name
    price = float(tk["lastPrice"]); chg = float(tk["priceChangePercent"])
    hi = float(tk["highPrice"]); lo = float(tk["lowPrice"]); vol = float(tk["quoteVolume"])
    d7 = (closes[-1]/closes[-8]-1)*100 if len(closes) >= 8 else 0.0
    reg, reg_txt = regime_read(closes)
    angle = CATEGORY_ANGLE[cat].format(name=name, sym=sym)
    fmt = lambda n: f"{n:,.0f}" if n >= 1000 else (f"{n:,.2f}" if n >= 1 else f"{n:,.4f}")
    as_of = time.strftime("%d %b %Y", time.gmtime())
    # prefer same-category neighbours (topically relevant internal links), top up with anything
    # else if the category is small, so every page still gets 4 related links.
    same_cat = [s for s in COINS if s != sym and COINS[s][2] == cat]
    other = [s for s in COINS if s != sym and COINS[s][2] != cat]
    related = [(s, COINS[s][0], COINS[s][1]) for s in (same_cat + other)[:4]]
    e = html.escape
    faqs = [
        (f"Can I paper-trade {name} strategies on zengtrade?",
         f"Yes. zengtrade runs regime-aware strategies on {name} ({sym}) using live market data, 24/7, in paper first, so you prove an edge before any real capital is at risk."),
        (f"Is {name} trading on zengtrade custodial?",
         f"No. zengtrade is non-custodial. Live execution runs on your own exchange with your own keys. It never holds your {sym} or funds."),
        (f"What market regime is {name} in right now?",
         f"As of {as_of}, {name}'s 30-day tape reads {reg}. {reg_txt} Regimes change, so the engine re-reads every cycle."),
    ]
    faq_schema = {"@context": "https://schema.org", "@type": "FAQPage",
                  "mainEntity": [{"@type": "Question", "name": q,
                                  "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]}
    crumb = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"},
        {"@type": "ListItem", "position": 2, "name": "Coins", "item": f"{SITE}/coins/"},
        {"@type": "ListItem", "position": 3, "name": name, "item": f"{SITE}/coins/{slug}/"}]}
    # Kept under ~60/~155 chars (Google's rough display budget for title/description before
    # truncation) even for the longest coin names, the {price}/{chg} data used to live inline
    # here, dropped since search-snippet copy is evergreen value-prop text, not a place for a
    # number that's stale the moment it's crawled, price/regime are shown live on the page itself.
    title = f"{name} ({sym}) Trading Strategies | zengtrade"
    desc = (f"Paper-trade regime-aware {sym} strategies on live {name} prices. "
            f"Real backtests, honest costs, non-custodial. Not investment advice.")
    faq_html = "".join(
        f'<details class="faq"><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in faqs)
    rel_html = "".join(
        f'<a class="home-card" href="/coins/{rslug}/"><b>{e(rn)}</b>'
        f'<span>{rs} strategies &amp; live regime read</span></a>'
        for rs, rn, rslug in related)
    extra_head = (f'<script type="application/ld+json">{json.dumps(crumb)}</script>'
                  f'<script type="application/ld+json">{json.dumps(faq_schema)}</script>')
    main = f"""<main id="main">
  <section class="lp-hero" aria-labelledby="h-coin">
    <div class="lp-wrap">
      <nav class="coin-crumb" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/coins/">Coins</a> &rsaquo; {e(name)}</nav>
      <div class="lp-eyebrow"><span class="dot"></span> live price · regime read · paper-tradeable</div>
      <h1 id="h-coin" class="lp-h1">{e(name)} <span class="hl">{sym}</span> trading strategies</h1>
      <div class="coin-price"><b data-live-price="{sym}">${fmt(price)}</b><span class="coin-chg {'up' if chg>=0 else 'down'}" data-live-chg="{sym}">{chg:+.2f}% 24h</span></div>
      {sparkline(closes)}
      <div class="coin-stats">
        <div class="coin-stat"><span>24h High</span><b>${fmt(hi)}</b></div>
        <div class="coin-stat"><span>24h Low</span><b>${fmt(lo)}</b></div>
        <div class="coin-stat"><span>7d change</span><b class="{'up' if d7>=0 else 'down'}">{d7:+.1f}%</b></div>
        <div class="coin-stat"><span>24h Volume</span><b>${fmt(vol)}</b></div>
      </div>
      <p class="coin-asof">Live snapshot {as_of}, refreshes on load.</p>
    </div>
  </section>

  <section class="lp-sec" aria-label="How zengtrade trades {e(name)}">
    <div class="lp-wrap">
      <div class="coin-regime"><div><b>Regime read: {e(reg)}</b><br><span>{e(reg_txt)}</span></div></div>
      <h2 class="lp-h2">How zengtrade trades {e(name)}</h2>
      <p class="lp-sub">{e(angle)} Every strategy runs <b>paper-first</b> on live {sym} data, so you prove an edge before a dollar is at risk, then run it on <b>your own exchange</b> (non-custodial, your keys).</p>
      <h2 class="lp-h2">Honest about the cost</h2>
      <p class="lp-sub">zengtrade never hides friction. Fees, slippage and (for Indian users) the 1% TDS are subtracted from every {sym} backtest and paper trade, so the edge you see is the edge <b>net of cost</b>, not a gross number that evaporates live. <a href="/learn/crypto-backtest-costs-fees-slippage-tds/">See exactly how these costs are calculated →</a></p>
    </div>
  </section>

  <section class="lp-sec" aria-label="{e(name)} FAQ">
    <div class="lp-wrap">
      <h2 class="lp-h2">{e(name)} FAQ</h2>
      {faq_html}
    </div>
  </section>

  <section class="lp-sec" aria-label="Related coins">
    <div class="lp-wrap">
      <h2 class="lp-h2">Related coins</h2>
      <div class="lp-grid4">{rel_html}</div>
      <div class="lp-cta-row center" style="margin-top:20px">
      <a class="lp-cta primary" href="/login?mode=signup&amp;utm_source=site&amp;utm_medium=organic&amp;utm_campaign=coin_{slug}">Start free, paper-trade {e(name)} strategies</a>
      <a class="lp-cta ghost" href="/login?mode=signup&amp;plan=pro&amp;utm_source=site&amp;utm_medium=organic&amp;utm_campaign=coin_{slug}_pro">Pro $19/mo — unlimited</a>
      </div>
      <p class="lp-fineprint">Live data · educational software, not investment advice · paper-first, non-custodial</p>
    </div>
  </section>
  <script>
  fetch("{BASE}/api/v3/ticker/24hr?symbol={sym}USDT").then(r=>r.json()).then(d=>{{
    var p=document.querySelector('[data-live-price="{sym}"]'), c=document.querySelector('[data-live-chg="{sym}"]');
    if(p) p.textContent="$"+(+d.lastPrice).toLocaleString("en-US",{{maximumFractionDigits:(+d.lastPrice>=1?2:4)}});
    if(c){{var v=+d.priceChangePercent; c.textContent=(v>=0?"+":"")+v.toFixed(2)+"% 24h"; c.className="coin-chg "+(v>=0?"up":"down");}}
  }}).catch(()=>{{}});
  </script>
</main>"""
    return title, desc, f"{SITE}/coins/{slug}/", main, extra_head


# Display order for hub sections - majors and the largest, most-searched groups first; the
# undifferentiated fallback bucket always last regardless of its size.
CATEGORY_ORDER = ["major", "layer-1", "layer-2", "defi", "payments", "infra", "ai", "gaming",
                  "meme", "privacy", "exchange-token", "altcoin"]

INLINE_FALLBACK_LIMIT = 16   # how many "More coins" cards show before the <details> disclosure


def _coin_card(sym):
    return (f'<a class="home-card" href="/coins/{COINS[sym][1]}/"><b>{html.escape(COINS[sym][0])}</b>'
            f'<span>{sym} strategies &amp; live regime read</span></a>')


def coin_hub_main(syms_present):
    """The /coins/ hub <main>, grouped by category so each section can independently target its
    own long-tail (e.g. "defi trading strategies"), rather than one flat 150-card grid. The
    fallback ("altcoin"/"More coins") bucket is progressively disclosed via a native <details> -
    reuses the same zero-JS pattern coin_parts() already uses for its FAQ - so it stays fully
    crawlable without dumping every uncategorised coin above the fold."""
    by_cat = {}
    for s in syms_present:
        by_cat.setdefault(COINS[s][2], []).append(s)
    sections = []
    for cat in CATEGORY_ORDER:
        syms = by_cat.get(cat)
        if not syms:
            continue
        label = CATEGORY_LABEL.get(cat, cat.title())
        intro = CATEGORY_HUB_INTRO.get(cat, "")
        if cat == "altcoin" and len(syms) > INLINE_FALLBACK_LIMIT:
            head, rest = syms[:INLINE_FALLBACK_LIMIT], syms[INLINE_FALLBACK_LIMIT:]
            grid = (f'<div class="lp-grid4">{"".join(_coin_card(s) for s in head)}</div>'
                    f'<details class="faq" style="margin-top:12px"><summary>Show {len(rest)} more</summary>'
                    f'<div class="lp-grid4" style="margin-top:12px">{"".join(_coin_card(s) for s in rest)}</div></details>')
        else:
            grid = f'<div class="lp-grid4">{"".join(_coin_card(s) for s in syms)}</div>'
        anchor = f"cat-{cat}"
        sections.append(f"""<section class="lp-sec" aria-label="{html.escape(label)}" id="{anchor}">
    <div class="lp-wrap">
      <h2 class="lp-h2">{html.escape(label)}</h2>
      <p class="lp-sub" style="margin-bottom:16px">{html.escape(intro)}</p>
      {grid}
    </div>
  </section>""")
    return f"""<main id="main">
  <section class="lp-hero" aria-labelledby="h-hub">
    <div class="lp-wrap">
      <div class="lp-eyebrow"><span class="dot"></span> trading strategies by coin</div>
      <h1 id="h-hub" class="lp-h1">Crypto strategies, <span class="hl">by coin</span></h1>
      <p class="lp-sub coin-hub-lead">Live prices, a current market-regime read, and paper-tradeable regime-aware strategies for each major coin, grouped by category. Honest about every cost, non-custodial.</p>
    </div>
  </section>
  {"".join(sections)}
  <section class="lp-sec" aria-label="Get started">
    <div class="lp-wrap">
      <div class="lp-cta-row center" style="margin-top:4px">
      <a class="lp-cta primary" href="/login?mode=signup&amp;utm_source=site&amp;utm_medium=organic&amp;utm_campaign=coins_hub">Start free — paper-trade any coin</a>
      <a class="lp-cta ghost" href="/login?mode=signup&amp;plan=pro&amp;utm_source=site&amp;utm_medium=organic&amp;utm_campaign=coins_hub_pro">Founding Pro $19/mo</a>
      </div>
    </div>
  </section>
</main>"""


def fetch_coins(syms=None):
    """Fetch (tk, closes) for each coin. Returns [(sym,name,slug,cat,tk,closes), ...] present."""
    syms = syms or list(COINS.keys())
    print("fetching 24h tickers…")
    all24 = {t["symbol"]: t for t in get("/api/v3/ticker/24hr")}
    out = []
    for sym in syms:
        name, slug, cat = COINS[sym]
        tk = all24.get(sym + "USDT")
        if not tk:
            print("  skip", sym, "(no ticker)"); continue
        kl = get("/api/v3/klines", symbol=sym + "USDT", interval="1d", limit=30)
        out.append((sym, name, slug, cat, tk, [float(k[4]) for k in kl]))
    return out


if __name__ == "__main__":
    print("This module is now a coin-content library. Run the whole site (marketing + coins,")
    print("all sharing one design system) with:  python3 deploy/landing/build.py")
