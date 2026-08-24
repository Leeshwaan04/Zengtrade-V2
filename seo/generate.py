#!/usr/bin/env python3
"""zengtrade programmatic-SEO generator, one DATA-RICH page per coin (the quality-first pSEO play).

Each page is genuinely unique: live price + 24h/7d stats, a 30-day SVG sparkline, a
regime "read" computed from real daily candles (trend vs range), category-specific strategy
guidance, an honest cost note, an FAQ, and hub-and-spoke internal links, with full per-page SEO
(title/description/canonical/OG + BreadcrumbList + FAQPage + FinancialProduct schema) and a sitemap.

NOT a thin-content mill: the data + the regime read + the category guidance vary per coin, so no
two pages are templated duplicates (which Google penalises as "scaled content abuse").

Run:  python3 seo/generate.py           # prototype set (5 coins) -> seo/out/
      python3 seo/generate.py --all     # every active USDT major (scale later)
"""
from __future__ import annotations
import html, json, os, sys, time

try:
    import requests
except ImportError:
    print("pip install requests"); sys.exit(1)

BASE = "https://data-api.binance.vision"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
SITE = "https://zengtrade.in"

# curated names + slugs for the prototype (real coins; scale from exchangeInfo later)
COINS = {
    "BTC": ("Bitcoin", "bitcoin", "major"),
    "ETH": ("Ethereum", "ethereum", "major"),
    "SOL": ("Solana", "solana", "layer-1"),
    "BNB": ("BNB", "bnb", "major"),
    "XRP": ("XRP", "xrp", "payments"),
    "ADA": ("Cardano", "cardano", "layer-1"),
    "DOGE": ("Dogecoin", "dogecoin", "payments"),
}

CATEGORY_ANGLE = {
    "major": "As a large-cap major, {name} tends to lead the market's regime. zengtrade's engine reads {sym}'s own trend against the broader BTC-led regime and only deploys directional strategies when the tape confirms, otherwise it stands down to cash.",
    "layer-1": "{name} is a higher-beta layer-1: it can trend hard in a bull regime and bleed fast in a bear. The engine sizes {sym} smaller and leans on the chandelier/trailing exit so a strong run is captured but a reversal is cut early.",
    "payments": "{name} often ranges for long stretches then moves in bursts. zengtrade favours mean-reversion and breakout confirmation on {sym} in choppy regimes, and stands directional strategies down until a real trend prints.",
}


def get(path, **params):
    r = requests.get(BASE + path, params=params, timeout=20)
    r.raise_for_status()
    return r.json()


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
    related = [(s, COINS[s][0], COINS[s][1]) for s in COINS if s != sym][:4]
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
    title = f"{name} ({sym}) trading strategies, paper-trade, backtest & regime read | zengtrade"
    desc = (f"Live {name} price ${fmt(price)} ({chg:+.2f}% 24h). Paper-trade regime-aware {sym} "
            f"strategies on live data, backtest the edge, and read {name}'s current market regime. "
            f"Honest about every cost, non-custodial. Not investment advice.")
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
      <p class="lp-sub">zengtrade never hides friction. Fees, slippage and (for Indian users) the 1% TDS are subtracted from every {sym} backtest and paper trade, so the edge you see is the edge <b>net of cost</b>, not a gross number that evaporates live.</p>
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


def coin_hub_main(syms_present):
    """The /coins/ hub <main>, using the shared design system."""
    cards = "".join(
        f'<a class="home-card" href="/coins/{COINS[s][1]}/"><b>{html.escape(COINS[s][0])}</b>'
        f'<span>{s} strategies &amp; live regime read</span></a>' for s in syms_present)
    return f"""<main id="main">
  <section class="lp-hero" aria-labelledby="h-hub">
    <div class="lp-wrap">
      <div class="lp-eyebrow"><span class="dot"></span> trading strategies by coin</div>
      <h1 id="h-hub" class="lp-h1">Crypto strategies, <span class="hl">by coin</span></h1>
      <p class="lp-sub coin-hub-lead">Live prices, a current market-regime read, and paper-tradeable regime-aware strategies for each major coin. Honest about every cost, non-custodial.</p>
    </div>
  </section>
  <section class="lp-sec" aria-label="Coins">
    <div class="lp-wrap"><div class="lp-grid4">{cards}</div>
      <div class="lp-cta-row center" style="margin-top:20px">
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
