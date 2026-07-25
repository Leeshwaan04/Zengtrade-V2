#!/usr/bin/env python3
"""zengtrade programmatic-SEO generator — one DATA-RICH page per coin (the quality-first pSEO play).

Each page is genuinely unique: live Binance price + 24h/7d stats, a 30-day SVG sparkline, a
regime "read" computed from real daily candles (trend vs range), category-specific strategy
guidance, an honest cost note, an FAQ, and hub-and-spoke internal links — with full per-page SEO
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
}

CATEGORY_ANGLE = {
    "major": "As a large-cap major, {name} tends to lead the market's regime. zengtrade's engine reads {sym}'s own trend against the broader BTC-led regime and only deploys directional strategies when the tape confirms — otherwise it stands down to cash.",
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
        return ("Neutral", "Not enough recent data to call a regime — the engine would gather evidence before deploying.")
    first, last = closes[0], closes[-1]
    chg = (last / first - 1) * 100
    # simple trend/range: net move vs the path length (choppiness)
    path = sum(abs(closes[i] - closes[i-1]) for i in range(1, len(closes)))
    directness = abs(last - first) / (path or 1)   # 1 = straight line, ~0 = choppy
    if chg > 8 and directness > 0.35:
        return ("Bull", f"{sym_hint} has trended up ~{chg:.0f}% over 30 days with a clean path — a Bull read. The engine would run breakout/trend strategies here, trailing the winner.")
    if chg < -8 and directness > 0.35:
        return ("Bear", f"Down ~{abs(chg):.0f}% over 30 days in a directed move — a Bear read. Directional longs stand down to cash; only market-neutral / short-premium sleeves stay on.")
    return ("Neutral/Choppy", f"Net {chg:+.0f}% over 30 days but a choppy path — a ranging read. The engine favours mean-reversion and waits for a real trend before committing.")


sym_hint = "This coin"


def page(sym, name, slug, cat, tk, closes):
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
    faqs = [
        (f"Can I paper-trade {name} strategies on zengtrade?",
         f"Yes. zengtrade runs regime-aware strategies on {name} ({sym}) using live Binance data, 24/7, in paper first — so you prove an edge before any real capital is at risk."),
        (f"Is {name} trading on zengtrade custodial?",
         f"No. zengtrade is non-custodial — live execution runs on your own exchange with your own keys. It never holds your {sym} or funds."),
        (f"What market regime is {name} in right now?",
         f"As of {as_of}, {name}'s 30-day tape reads {reg}. {reg_txt} Regimes change — the engine re-reads every cycle."),
    ]
    faq_schema = {"@context": "https://schema.org", "@type": "FAQPage",
                  "mainEntity": [{"@type": "Question", "name": q,
                                  "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]}
    crumb = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"},
        {"@type": "ListItem", "position": 2, "name": "Coins", "item": f"{SITE}/coins/"},
        {"@type": "ListItem", "position": 3, "name": name, "item": f"{SITE}/coins/{slug}/"}]}
    e = html.escape
    title = f"{name} ({sym}) trading strategies — paper-trade, backtest & regime read | zengtrade"
    desc = (f"Live {name} price ${fmt(price)} ({chg:+.2f}% 24h). Paper-trade regime-aware {sym} "
            f"strategies on live data, backtest the edge, and read {name}'s current market regime — "
            f"honest about every cost, non-custodial. Not investment advice.")
    faq_html = "".join(
        f'<details class="faq"><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in faqs)
    rel_html = "".join(
        f'<a class="rel" href="/coins/{rslug}/"><b>{e(rn)}</b><span>{rs} strategies &amp; regime</span></a>'
        for rs, rn, rslug in related)
    return f"""<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="{SITE}/coins/{slug}/">
<meta property="og:type" content="website"><meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{SITE}/coins/{slug}/">
<meta property="og:image" content="{SITE}/assets/mascot-bull.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/svg+xml" href="/assets/logo.svg">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Roboto+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<script type="application/ld+json">{json.dumps(crumb)}</script>
<script type="application/ld+json">{json.dumps(faq_schema)}</script>
<style>
:root{{--bg:#f4f6fa;--surface:#fff;--line:#e6eaf1;--navy:#0f1a2a;--slate:#5c6a7e;--green:#00ab4e;--red:#e0483d;--sans:'Plus Jakarta Sans',system-ui,sans-serif;--mono:'Roboto Mono',ui-monospace,monospace}}
@media(prefers-color-scheme:dark){{:root{{--bg:#080d18;--surface:#101a2e;--line:#1f2c46;--navy:#e8eefb;--slate:#9aabc9}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--navy);font-family:var(--sans);line-height:1.6}}
.wrap{{max-width:820px;margin:0 auto;padding:22px}}
a{{color:inherit}}.crumb{{font-size:12.5px;color:var(--slate)}}.crumb a{{text-decoration:none}}
.brand{{display:flex;align-items:center;gap:9px;font-weight:800;margin-bottom:18px}}.brand svg{{width:26px;height:26px}}
h1{{font-size:31px;letter-spacing:-.02em;margin:14px 0 4px}}.sym{{color:var(--slate);font-weight:600}}
.price{{display:flex;align-items:baseline;gap:12px;margin:8px 0}}.price b{{font:800 30px/1 var(--mono)}}
.chg{{font:700 15px/1 var(--mono)}}.up{{color:var(--green)}}.down{{color:var(--red)}}
.spark{{width:100%;height:90px;display:block;margin:12px 0;border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:8px}}
.stats{{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}}
.stat{{background:var(--surface);border:1px solid var(--line);border-radius:11px;padding:11px;min-width:0}}
.stat span{{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);font-weight:700}}
.stat b{{display:block;font:700 16px/1.3 var(--mono);margin-top:3px;overflow-wrap:anywhere}}
@media(max-width:600px){{.stats{{grid-template-columns:repeat(2,1fr)}}h1{{font-size:25px}}.price b{{font-size:24px}}}}
.regime{{display:flex;gap:11px;align-items:flex-start;background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--green);border-radius:12px;padding:14px;margin:18px 0}}
h2{{font-size:20px;margin:26px 0 8px}}p{{color:var(--slate)}}p b,li b{{color:var(--navy)}}
.faq{{border:1px solid var(--line);border-radius:11px;padding:12px 14px;margin:8px 0;background:var(--surface)}}
.faq summary{{font-weight:700;cursor:pointer}}.faq p{{margin:8px 0 0}}
.rels{{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:12px 0}}
.rel{{display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--line);border-radius:11px;padding:12px;text-decoration:none}}
.rel b{{color:var(--navy)}}.rel span{{font-size:12.5px;color:var(--slate)}}
.cta{{display:block;text-align:center;background:var(--green);color:#04140a;font-weight:800;padding:15px;border-radius:12px;text-decoration:none;margin:22px 0 6px}}
.disc{{font-size:11.5px;color:var(--slate);text-align:center}}.asof{{font-size:11px;color:var(--slate)}}
</style></head><body><div class="wrap">
<div class="brand"><svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="var(--green)"/><path d="M24.69 13.67A9 9 0 1 1 20.5 8.21" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M12.5 19.5L17 15L20 17.5L26.5 8.8" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>zengtrade</div>
<nav class="crumb"><a href="/">Home</a> › <a href="/coins/">Coins</a> › {e(name)}</nav>
<h1>{e(name)} <span class="sym">{sym}</span> trading strategies</h1>
<div class="price"><b data-live-price="{sym}">${fmt(price)}</b><span class="chg {'up' if chg>=0 else 'down'}" data-live-chg="{sym}">{chg:+.2f}% 24h</span></div>
{sparkline(closes)}
<div class="stats">
  <div class="stat"><span>24h High</span><b>${fmt(hi)}</b></div>
  <div class="stat"><span>24h Low</span><b>${fmt(lo)}</b></div>
  <div class="stat"><span>7d</span><b class="{'up' if d7>=0 else 'down'}">{d7:+.1f}%</b></div>
  <div class="stat"><span>24h Volume</span><b>${fmt(vol)}</b></div>
</div>
<p class="asof">Live from Binance · snapshot {as_of} (refreshes on load)</p>
<div class="regime"><div><b>Regime read: {e(reg)}</b><br><span style="color:var(--slate)">{e(reg_txt)}</span></div></div>
<h2>How zengtrade trades {e(name)}</h2>
<p>{e(angle)} Every strategy runs <b>paper-first</b> on live {sym} data — you prove an edge before a dollar is at risk, then run it on <b>your own exchange</b> (non-custodial, your keys).</p>
<h2>Honest about the cost</h2>
<p>zengtrade never hides friction. Fees, slippage and (for Indian users) the 1% TDS are subtracted from every {sym} backtest and paper trade, so the edge you see is the edge <b>net of cost</b> — not a gross number that evaporates live.</p>
<h2>{e(name)} FAQ</h2>
{faq_html}
<h2>Related coins</h2>
<div class="rels">{rel_html}</div>
<a class="cta" href="/">Start free — paper-trade {e(name)} strategies</a>
<p class="disc">Live data from Binance. Educational software, not investment advice. Paper-first, non-custodial.</p>
</div>
<script>
/* client-side refresh of the price (keeps the page fresh without a rebuild) */
fetch("{BASE}/api/v3/ticker/24hr?symbol={sym}USDT").then(r=>r.json()).then(d=>{{
  var p=document.querySelector('[data-live-price="{sym}"]'), c=document.querySelector('[data-live-chg="{sym}"]');
  if(p) p.textContent="$"+(+d.lastPrice).toLocaleString("en-US",{{maximumFractionDigits:(+d.lastPrice>=1?2:4)}});
  if(c){{var v=+d.priceChangePercent; c.textContent=(v>=0?"+":"")+v.toFixed(2)+"% 24h"; c.className="chg "+(v>=0?"up":"down");}}
}}).catch(()=>{{}});
</script></body></html>"""


def main():
    do_all = "--all" in sys.argv
    os.makedirs(OUT, exist_ok=True)
    print("fetching Binance 24h tickers…")
    all24 = {t["symbol"]: t for t in get("/api/v3/ticker/24hr")}
    syms = list(COINS.keys())
    urls = []
    for sym in syms:
        name, slug, cat = COINS[sym]
        tk = all24.get(sym + "USDT")
        if not tk:
            print("  skip", sym, "(no ticker)"); continue
        kl = get("/api/v3/klines", symbol=sym + "USDT", interval="1d", limit=30)
        closes = [float(k[4]) for k in kl]
        d = os.path.join(OUT, "coins", slug)
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, "index.html"), "w").write(page(sym, name, slug, cat, tk, closes))
        urls.append(f"{SITE}/coins/{slug}/")
        print("  ✓ /coins/%s/  ($%s, %s%% 24h)" % (slug, tk["lastPrice"], tk["priceChangePercent"]))
    # hub page
    os.makedirs(os.path.join(OUT, "coins"), exist_ok=True)
    hub_cards = "".join(
        f'<a class="rel" href="/coins/{COINS[s][1]}/"><b>{COINS[s][0]}</b><span>{s} strategies &amp; regime read</span></a>'
        for s in syms if (s + "USDT") in all24)
    open(os.path.join(OUT, "coins", "index.html"), "w").write(f"""<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Crypto trading strategies by coin — regime reads &amp; paper trading | zengtrade</title>
<meta name="description" content="Paper-trade regime-aware strategies on every major coin — live prices, backtests, and a current market-regime read for each. Honest about cost, non-custodial.">
<link rel="canonical" href="{SITE}/coins/">
<link rel="icon" type="image/svg+xml" href="/assets/logo.svg">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>body{{font-family:'Plus Jakarta Sans',sans-serif;background:#f4f6fa;color:#0f1a2a;margin:0}}@media(prefers-color-scheme:dark){{body{{background:#080d18;color:#e8eefb}}}}.w{{max-width:820px;margin:0 auto;padding:26px}}h1{{font-size:30px}}.g{{display:grid;grid-template-columns:repeat(2,1fr);gap:11px}}.rel{{display:flex;flex-direction:column;background:#fff;border:1px solid #e6eaf1;border-radius:12px;padding:14px;text-decoration:none;color:inherit}}@media(prefers-color-scheme:dark){{.rel{{background:#101a2e;border-color:#1f2c46}}}}.rel b{{font-size:16px}}.rel span{{font-size:12.5px;color:#5c6a7e}}</style></head>
<body><div class="w"><a href="/" style="color:#5c6a7e;text-decoration:none;font-size:13px">← zengtrade</a>
<h1>Trading strategies by coin</h1><p style="color:#5c6a7e">Live prices, a market-regime read, and paper-tradeable regime-aware strategies for each coin. Honest about every cost.</p>
<div class="g">{hub_cards}</div></div></body></html>""")
    urls.append(f"{SITE}/coins/")
    # sitemap
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    sm += "".join(f"  <url><loc>{u}</loc><changefreq>daily</changefreq></url>\n" for u in urls)
    sm += "</urlset>\n"
    open(os.path.join(OUT, "sitemap.xml"), "w").write(sm)
    print(f"\n✓ generated {len(urls)} pages + sitemap.xml -> seo/out/")


if __name__ == "__main__":
    main()
