#!/usr/bin/env python3
"""Build the zengtrade marketing site as multiple pages sharing ONE design system.

Extracts the CSS + chrome (header/ticker/mega-nav) + footer from the original regime page and
generates:
  /                 -> NEW classy home
  /how-it-works/    -> the regime explainer (the old home, moved)
  /pricing/         -> NEW detailed pricing page
All share /site.css, /site.js, the same header/ticker/nav, assets, and the live crypto tape.
Run:  python3 deploy/landing/build.py   ->  writes into deploy/landing/dist/
"""
import os, re, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = open(os.path.join(HERE, "index.html")).read()
DIST = os.path.join(HERE, "dist")


def between(s, a, b):
    return s[s.index(a): s.index(b) + len(b)]


# ---- extract shared pieces from the original page --------------------------------------
css = SRC[SRC.index("<style>") + 7: SRC.index("</style>")]
# prebody = everything after <body> up to the header: the .ambient animated background
# (aurora glows + grid-motion) + the skip link. MUST be carried onto every page.
prebody = SRC[SRC.index("<body>") + len("<body>"): SRC.index('<header class="topbar">')]
chrome = between(SRC, '<header class="topbar">', '<main id="main">').rsplit('<main id="main">', 1)[0]
main_hiw = between(SRC, '<main id="main">', "</main>")
tail = SRC[SRC.index("</main>") + len("</main>"): SRC.index("</body>")]     # footer + scripts

# make asset + mascot paths absolute so they work from /how-it-works/ and /pricing/
def absolutize(x):
    x = x.replace('href="assets/', 'href="/assets/').replace('src="assets/', 'src="/assets/')
    x = x.replace('url(assets/', 'url(/assets/').replace('"assets/mascot-', '"/assets/mascot-')
    return x
css, prebody, chrome, main_hiw, tail = map(absolutize, (css, prebody, chrome, main_hiw, tail))

# rewire the mega-nav to the real cross-page URLs
navmap = {
    'href="#regime">How it works</a>': 'href="/how-it-works/">How it works</a>',
    'href="#go-live">Pricing</a>': 'href="/pricing/">Pricing</a>',
    'href="#regime"><span class="lp-mega-ic">◐': 'href="/how-it-works/#regime"><span class="lp-mega-ic">◐',
    'href="#survival"><span class="lp-mega-ic">◈': 'href="/how-it-works/#survival"><span class="lp-mega-ic">◈',
    'href="#books"><span class="lp-mega-ic">₿': 'href="/how-it-works/#books"><span class="lp-mega-ic">₿',
    'href="#honesty"><span class="lp-mega-ic">✓': 'href="/how-it-works/#honesty"><span class="lp-mega-ic">✓',
    'href="#books"><span class="lp-mega-tx"><b>Strategy library': 'href="/how-it-works/#books"><span class="lp-mega-tx"><b>Strategy library',
    'href="#regime"><span class="lp-mega-tx"><b>Reading market': 'href="/how-it-works/#regime"><span class="lp-mega-tx"><b>Reading market',
    'href="#honesty"><span class="lp-mega-tx"><b>Why honesty': 'href="/how-it-works/#honesty"><span class="lp-mega-tx"><b>Why honesty',
}
for a, b in navmap.items():
    chrome = chrome.replace(a, b)

# the crypto-tape JS lives in tail; keep it. (regime JS no-ops where mascots are absent.)

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Roboto+Mono:wght@400;500;600&display=swap" rel="stylesheet">')


# First-party pageview beacon: one tiny insert into the public `event` table (anon policy
# allows only name='pageview' + short path/ref). No cookies, no third party. Powers the
# funnel numbers in /admin. Fails silently so it can never break a page.
BEACON = """<script>
(function(){try{
 var u=new URLSearchParams(location.search),bits=[];
 ["utm_source","utm_medium","utm_campaign"].forEach(function(k){var v=u.get(k);if(v)bits.push(k+"="+v);});
 var path=location.pathname.slice(0,220)+(bits.length?"?"+bits.join("&"):"");
 fetch("https://ponvarxeytfcntckczbn.supabase.co/rest/v1/event",{method:"POST",
  headers:{apikey:"sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1","Content-Type":"application/json",Prefer:"return=minimal"},
  body:JSON.stringify({name:"pageview",path:path.slice(0,290),ref:(document.referrer||"").slice(0,290)}),
  keepalive:true}).catch(function(){});
}catch(e){}})();
</script>"""


def shell(title, desc, canon, main, extra_head=""):
    return f"""<!DOCTYPE html><html lang="en" data-regime="bull"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>document.documentElement.className+=" js";</script>
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="{canon}">
<meta property="og:type" content="website"><meta property="og:site_name" content="zengtrade">
<meta property="og:title" content="{title}"><meta property="og:description" content="{desc}">
<meta property="og:url" content="{canon}"><meta property="og:image" content="https://zengtrade.in/assets/mascot-bull.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}"><meta name="twitter:image" content="https://zengtrade.in/assets/mascot-bull.png">
<meta name="theme-color" content="#f4f6fa" id="themeColor"><meta name="color-scheme" content="light dark">
<link rel="icon" type="image/svg+xml" href="/assets/logo.svg">
{FONTS}
<link rel="stylesheet" href="/site.css">{extra_head}
</head><body>
{prebody}
{chrome}
{main}
{tail}
{BEACON}
</body></html>"""


# ---- NEW HOME -------------------------------------------------------------------------
HOME_MAIN = """<main id="main">
  <section class="lp-hero" aria-labelledby="h-hero">
    <div class="lp-wrap">
      <div class="lp-eyebrow"><span class="dot"></span> paper-first · non-custodial · regime-aware</div>
      <h1 id="h-hero" class="lp-h1">Trading that reads the market's <span class="hl">mood</span>, and refuses to lose your money.</h1>
      <p class="lp-sub">zengtrade runs battle-tested, regime-aware strategies on live data, 24/7. It's honest about every cost, allergic to hype, and paper-first: it proves an edge before a rupee or a dollar is at risk. Then run it on <b>your own exchange</b>, with your keys and your coins.</p>
      <div class="lp-cta-row">
        <a class="lp-cta primary" href="/login?mode=signup&amp;utm_source=site&amp;utm_medium=organic&amp;utm_campaign=landing">Start free, no card</a>
        <a class="lp-cta ghost" href="/how-it-works/">See how it works →</a>
      </div>
      <p class="lp-fineprint">Free to start · paper trading only at launch · not investment advice</p>
    </div>
  </section>

  <section class="lp-sec home-pillars" aria-label="Why zengtrade">
    <div class="lp-wrap lp-grid4">
      <div class="home-card"><div class="hc-ic">◐</div><b>Regime-aware</b><span>Reads Bull, Neutral &amp; Bear, and runs only the strategies proven to win in the current regime.</span></div>
      <div class="home-card"><div class="hc-ic">◈</div><b>Survival-first</b><span>A Governor, kill-switch and position intelligence sit over every trade. Cash is a deliberate position.</span></div>
      <div class="home-card"><div class="hc-ic">✓</div><b>Radically honest</b><span>Never fabricates a number. Every backtest is net of fees, slippage &amp; tax, a dash when it can't source one.</span></div>
      <div class="home-card"><div class="hc-ic">₿</div><b>Crypto-native, 24/7</b><span>Live Binance prices around the clock — the same survival-first engine, built for crypto from the ground up.</span></div>
    </div>
  </section>

  <section class="lp-sec home-regime" aria-label="Market regimes">
    <div class="lp-wrap home-regime-in">
      <img class="home-mascot" src="/assets/mascot-bull.png" alt="zengtrade bull mascot" width="180" height="180" loading="lazy">
      <div>
        <div class="lp-eyebrow"><span class="dot"></span> the core idea</div>
        <h2 class="lp-h2">The market has moods. The engine reads them.</h2>
        <p class="lp-sub">Bull, Neutral, Bear: no strategy wins in every regime, so the engine deploys the ones proven to fit the tape and stands the rest down to cash. That's how it protects capital first and compounds second.</p>
        <a class="lp-cta ghost" href="/how-it-works/">How the regime engine works →</a>
      </div>
    </div>
  </section>

  <section class="lp-sec home-final" aria-label="Get started">
    <div class="lp-wrap home-final-in">
      <h2 class="lp-h2">Prove the edge before you risk a thing.</h2>
      <p class="lp-sub">Start free. Paper-trade every strategy on live data. Upgrade only when a strategy earns its place.</p>
      <div class="lp-cta-row center"><a class="lp-cta primary" href="/login?mode=signup&amp;utm_source=site&amp;utm_medium=organic&amp;utm_campaign=landing">Start free</a><a class="lp-cta ghost" href="/pricing/">See pricing</a></div>
    </div>
  </section>
</main>"""

# ---- NEW PRICING ----------------------------------------------------------------------
def plan(name, price, per, tag, feats, featured=False, cta="Start free", pid=""):
    lis = "".join(f"<li>{f}</li>" for f in feats)
    href = "/login?mode=signup&amp;utm_source=site&amp;utm_medium=organic&amp;utm_campaign=pricing" + (f"&amp;plan={pid}" if pid else "")
    return f"""<div class="pr-plan{' feat' if featured else ''}">{'<div class="pr-ribbon">Most popular</div>' if featured else ''}
      <div class="pr-name">{name}</div><div class="pr-price">{price}<span>{per}</span></div>
      <div class="pr-tag">{tag}</div><ul class="pr-feats">{lis}</ul>
      <a class="lp-cta {'primary' if featured else 'ghost'} full" href="{href}">{cta}</a></div>"""

PRICING_MAIN = f"""<main id="main">
  <section class="lp-sec pr-head" aria-labelledby="h-pr">
    <div class="lp-wrap center">
      <div class="lp-eyebrow"><span class="dot"></span> simple · honest · cancel anytime</div>
      <h1 id="h-pr" class="lp-h1">Pricing that only charges when it earns its place.</h1>
      <p class="lp-sub">Start free and paper-trade forever. You pay only when you want unlimited strategies and live execution on your own exchange, never for the data, never for hidden extras.</p>
      <p class="lp-sub" style="margin-top:12px"><b>Founding offer:</b> first 100 Pro members lock in <b>$19/mo</b> (normally $29) — unlimited paper while live execution rolls out.</p>
    </div>
  </section>
  <section class="lp-sec" aria-label="Plans">
    <div class="lp-wrap pr-grid">
      {plan("Free", "$0", "forever", "Learn &amp; paper-trade, free forever", ["1 paper strategy","Live crypto prices, 24/7","Backtest + Forward Test","Accuracy &amp; Analytics","Honest, cost-accurate P&amp;L"], cta="Get started")}
      {plan("Pro", "$19", "/mo", "Founding price · unlimited paper", ["Everything in Free","<b>Unlimited</b> paper strategies","Live execution <em>(coming soon)</em> — per go-live bar*","Tick-level stops &amp; kill-switch <em>(with live)</em>","Email &amp; push alerts"], featured=True, cta="Get Pro", pid="pro")}
      {plan("Elite", "$79", "/mo", "Maximum firepower", ["Everything in Pro","Perps + options engines","Multiple exchange accounts","Custom risk parameters","Priority support &amp; early access"], cta="Get Elite", pid="elite")}
    </div>
    <p class="pr-iso center">* Live execution unlocks per strategy only after it clears the go-live bar in paper. Non-custodial, your keys, your coins. Not investment advice.</p>
  </section>
  <section class="lp-sec pr-what" aria-label="What you pay for">
    <div class="lp-wrap">
      <h2 class="lp-h2 center">What you're actually paying for</h2>
      <div class="lp-grid3">
        <div class="home-card"><div class="hc-ic">∞</div><b>Unlimited strategies</b><span>Free runs one paper strategy. Pro removes the cap, run the whole regime-aware library at once.</span></div>
        <div class="home-card"><div class="hc-ic">◈</div><b>Live execution (coming soon)</b><span>When shipped, route a proven strategy to <b>your own</b> exchange with your own keys. We never custody funds. Unlocks only after the paper go-live bar.</span></div>
        <div class="home-card"><div class="hc-ic">🔔</div><b>Alerts &amp; control</b><span>Tick-level stops, a portfolio kill-switch, and email/push alerts so you're never surprised.</span></div>
      </div>
      <p class="pr-note center">Data is always free and always live. We charge for <b>capability</b>, not for the numbers, and never hide a cost inside a plan.</p>
    </div>
  </section>
  <section class="lp-sec pr-faq" aria-label="Pricing FAQ">
    <div class="lp-wrap">
      <h2 class="lp-h2 center">Pricing questions</h2>
      <details class="faq"><summary>Is there really a free plan?</summary><p>Yes, Free is free forever. One paper strategy, live crypto data, full backtest/forward-test and honest analytics. No card required.</p></details>
      <details class="faq"><summary>Do you take a cut of my trades or hold my funds?</summary><p>No. zengtrade is non-custodial. Live execution runs on your own exchange with your own API keys, we never touch your coins and take no trading commission.</p></details>
      <details class="faq"><summary>Can I cancel anytime?</summary><p>Anytime, in one click. You keep Free access after cancelling.</p></details>
      <details class="faq"><summary>Why is live execution gated?</summary><p>A strategy only unlocks live once it clears the go-live bar in paper, enough closed trades, positive expectancy net of cost, across regimes. We'd rather you prove the edge than pay to lose money.</p></details>
    </div>
  </section>
  <section class="lp-sec home-final"><div class="lp-wrap home-final-in"><h2 class="lp-h2">Start free. Upgrade only when it's earned.</h2><div class="lp-cta-row center"><a class="lp-cta primary" href="/login?mode=signup&amp;utm_source=site&amp;utm_medium=organic&amp;utm_campaign=pricing">Start free, no card</a></div></div></section>
</main>"""

HOME_CSS = """
/* ===== home + pricing (shared components, same tokens) ===== */
.lp-cta-row{display:flex;gap:12px;flex-wrap:wrap;margin:22px 0 10px}.lp-cta-row.center{justify-content:center}
.lp-cta{display:inline-flex;align-items:center;justify-content:center;font:700 15px/1 var(--sans);border-radius:12px;padding:15px 24px;text-decoration:none;transition:transform .12s,box-shadow .2s,background .2s;border:1px solid transparent}
.lp-cta.primary{background:var(--accent);color:#04140a}.lp-cta.primary:hover{transform:translateY(-1px);box-shadow:0 10px 24px -10px color-mix(in srgb,var(--accent) 70%,transparent)}
.lp-cta.ghost{background:var(--surface);color:var(--navy);border-color:var(--line-2,var(--line))}.lp-cta.ghost:hover{border-color:var(--accent);color:var(--accent)}
.lp-cta.full{display:flex;width:100%}
.lp-fineprint{font:600 12px/1 var(--mono);color:var(--slate-2,var(--slate));letter-spacing:.3px}
.lp-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.lp-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:18px 0}
.home-card{background:var(--surface);border:1px solid var(--line);border-radius:15px;padding:18px}
.home-card b{display:block;font-size:16px;margin:10px 0 5px}.home-card span{color:var(--slate);font-size:13.5px;line-height:1.55}
.hc-ic{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;font-size:19px;font-weight:800;background:var(--green-soft,#e7f8ef);color:var(--green)}
.home-regime-in{display:flex;align-items:center;gap:30px}.home-mascot{flex:0 0 auto;width:180px;height:auto;filter:drop-shadow(0 18px 34px rgba(0,0,0,.16))}
.home-final-in{text-align:center;background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:38px 24px}
.pr-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;align-items:start}
.pr-plan{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:22px}
.pr-plan.feat{border-color:var(--accent);box-shadow:0 20px 50px -22px color-mix(in srgb,var(--accent) 45%,transparent)}
.pr-ribbon{position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:var(--accent);color:#04140a;font:800 10.5px/1 var(--sans);letter-spacing:.4px;padding:5px 12px;border-radius:20px;text-transform:uppercase}
.pr-name{font-weight:800;font-size:14px;color:var(--slate);text-transform:uppercase;letter-spacing:.5px}
.pr-price{font:800 34px/1 var(--sans);margin:6px 0}.pr-price span{font:600 14px/1 var(--sans);color:var(--slate)}
.pr-tag{color:var(--slate);font-size:13.5px;margin-bottom:12px}
.pr-feats{list-style:none;padding:0;margin:0 0 16px}.pr-feats li{padding:7px 0 7px 24px;position:relative;font-size:13.5px;color:var(--navy);border-top:1px solid var(--line)}
.pr-feats li::before{content:"✓";position:absolute;left:0;color:var(--green);font-weight:800}
.pr-iso,.pr-note{color:var(--slate);font-size:12.5px;max-width:640px;margin:16px auto 0}
.faq{border:1px solid var(--line);border-radius:12px;padding:13px 16px;margin:9px 0;background:var(--surface);max-width:720px;margin-left:auto;margin-right:auto}
.faq summary{font-weight:700;cursor:pointer;color:var(--navy)}.faq p{margin:9px 0 0;color:var(--slate)}
.center{text-align:center}
@media(max-width:820px){.lp-grid4{grid-template-columns:repeat(2,1fr)}.lp-grid3,.pr-grid{grid-template-columns:1fr}.home-regime-in{flex-direction:column;text-align:center}}
"""

# ---- coin pSEO content lives in seo/generate.py (now a library that shares THIS shell) --
coin_css, coins = "", []
try:
    import sys
    sys.path.insert(0, os.path.abspath(os.path.join(HERE, "..", "..", "seo")))
    import generate as G
    coin_css = G.COIN_CSS
    coins = G.fetch_coins()                       # live data; skipped gracefully if offline
except Exception as ex:
    print("  ! coin pages skipped (marketing site still builds):", ex)

# ---- write everything -----------------------------------------------------------------
if os.path.exists(DIST):
    shutil.rmtree(DIST)
os.makedirs(DIST)
shutil.copytree(os.path.join(HERE, "assets"), os.path.join(DIST, "assets"))
open(os.path.join(DIST, "site.css"), "w").write(css + HOME_CSS + coin_css)   # ONE stylesheet for every page

# ---- bundle the Supabase auth app onto the SAME origin (login / dashboard / legal) -----
# Written as FOLDERS (login/index.html) so clean URLs work on GitHub Pages, which has no
# _redirects/rewrites. So /login, /dashboard, /reset, /terms, /privacy, /risk resolve as static
# folders. We deliberately DON'T copy saas/web/index.html (old SaaS landing; the real home is this
# build). Auth pages keep their focused css.css + js/ (Supabase glue).
AUTH_SRC = os.path.abspath(os.path.join(HERE, "..", "..", "saas", "web"))
AUTH_ROUTES = {                                   # source file -> clean route folder
    "login.html": "login", "reset.html": "reset", "admin.html": "admin",
    "app.html": "app",                             # billing, evidence tabs, pricing (#pricing)
    "ops.html": "ops",                             # founder autopilot dashboard (HTML, not md)
    "terms.html": "terms", "privacy.html": "privacy", "risk.html": "risk",
}   # /dashboard = Algo Studio terminal (below); /app = SaaS dashboard + checkout return.
for f, route_dir in AUTH_ROUTES.items():
    src = os.path.join(AUTH_SRC, f)
    if os.path.exists(src):
        d = os.path.join(DIST, route_dir); os.makedirs(d, exist_ok=True)
        shutil.copy(src, os.path.join(d, "index.html"))
_ops_data = os.path.join(AUTH_SRC, "ops-data.json")
if os.path.exists(_ops_data):
    d = os.path.join(DIST, "ops"); os.makedirs(d, exist_ok=True)
    shutil.copy(_ops_data, os.path.join(d, "data.json"))
_ops_manifest = os.path.join(AUTH_SRC, "ops-manifest.json")
if os.path.exists(_ops_manifest):
    d = os.path.join(DIST, "ops"); os.makedirs(d, exist_ok=True)
    shutil.copy(_ops_manifest, os.path.join(d, "manifest.json"))
_mig11 = os.path.abspath(os.path.join(HERE, "..", "..", "saas", "db", "migrations", "0011_funnel_events_v2.sql"))
if os.path.exists(_mig11):
    d = os.path.join(DIST, "ops"); os.makedirs(d, exist_ok=True)
    shutil.copy(_mig11, os.path.join(d, "migrate.sql"))
for _sub, _fname in (("migrate", "ops-migrate.html"), ("worker", "ops-worker.html"), ("gsc", "ops-gsc.html"), ("billing", "ops-billing.html"), ("e2e", "ops-e2e.html"), ("p0", "ops-p0.html"), ("security", "ops-security.html")):
    _src = os.path.join(AUTH_SRC, _fname)
    if os.path.exists(_src):
        _d = os.path.join(DIST, "ops", _sub); os.makedirs(_d, exist_ok=True)
        shutil.copy(_src, os.path.join(_d, "index.html"))
shutil.copy(os.path.join(AUTH_SRC, "css.css"), os.path.join(DIST, "css.css"))
for d in ("js", "assets"):                        # js = auth glue; assets merge (logo etc.)
    sd = os.path.join(AUTH_SRC, d)
    if os.path.isdir(sd):
        shutil.copytree(sd, os.path.join(DIST, d), dirs_exist_ok=True)

# ---- /dashboard = the REAL Algo Studio terminal (customer edition) ------------------
# The operator's terminal (root index.html + assets/) IS the product. build copies it
# verbatim and injects studio.js (auth guard + snapshot-backed data shim + cockpit trim);
# snapshot.py publishes sanitized engine output into studio_data/ (run it to refresh).
# The local terminal at :8011 never loads studio.js and is untouched.
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SD = os.path.join(DIST, "dashboard"); os.makedirs(SD, exist_ok=True)
term = open(os.path.join(ROOT, "index.html")).read()
CSP_STUDIO = ("default-src 'self'; script-src 'self'; "
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
              "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; "
              "connect-src 'self' https://data-api.binance.vision wss://data-stream.binance.vision "
              "https://ponvarxeytfcntckczbn.supabase.co; "
              "object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
term = re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*/>',
              f'<meta http-equiv="Content-Security-Policy" content="{CSP_STUDIO}" />', term, count=1)
term = term.replace('<script src="assets/chart.js',
                    '<script src="studio.js?v=6"></script>\n<script src="assets/chart.js')
assert 'studio.js' in term, "studio.js injection failed - terminal script tags moved?"
open(os.path.join(SD, "index.html"), "w").write(term)
shutil.copy(os.path.join(HERE, "studio.js"), os.path.join(SD, "studio.js"))
shutil.copytree(os.path.join(ROOT, "assets"), os.path.join(SD, "assets"), dirs_exist_ok=True,
                ignore=shutil.ignore_patterns("app 2.js", "*.py", "*-orig.png", "ft-view.png"))
STUDIO_DATA = os.path.join(HERE, "studio_data")
if os.path.isdir(STUDIO_DATA):
    shutil.copytree(STUDIO_DATA, os.path.join(SD, "data"), dirs_exist_ok=True)

# GitHub Pages custom domain (also harmless on other hosts)
open(os.path.join(DIST, "CNAME"), "w").write("zengtrade.in\n")
# 404 fallback so unknown paths get a branded page (GitHub Pages serves /404.html)
open(os.path.join(DIST, "_redirects"), "w").write(   # kept for hosts that DO read it (CF/Netlify)
    "https://zengtrade.netlify.app/*   https://zengtrade.in/:splat   301!\n")

urls = []
def emit(path, html_str, canon):
    d = os.path.join(DIST, path) if path else DIST
    os.makedirs(d, exist_ok=True)
    open(os.path.join(d, "index.html"), "w").write(html_str)
    urls.append(canon)

emit("", shell(
    "zengtrade, regime-aware crypto trading strategies, paper-first",
    "Regime-aware algorithmic crypto trading strategies you can paper-trade, backtest and forward-test on live data before risking a dollar. Survival-first, honest about every cost, non-custodial. Not investment advice.",
    "https://zengtrade.in/", HOME_MAIN), "https://zengtrade.in/")

emit("how-it-works", shell(
    "How zengtrade works, the regime engine, honesty & survival-first risk",
    "How zengtrade works: it reads Bull/Neutral/Bear regimes, runs only the strategies proven to fit, never fabricates a number, and protects capital first. Paper-first, non-custodial.",
    "https://zengtrade.in/how-it-works/", main_hiw), "https://zengtrade.in/how-it-works/")

emit("pricing", shell(
    "Pricing, free to start, pay only for live execution | zengtrade",
    "zengtrade pricing: Free forever to paper-trade, Pro for unlimited paper strategies (founding $19/mo). Live execution rolls out per go-live bar. Data is always free. Non-custodial. Cancel anytime.",
    "https://zengtrade.in/pricing/", PRICING_MAIN), "https://zengtrade.in/pricing/")

# ---- coin hub + per-coin pages (identical shell -> full design parity) -----------------
if coins:
    present = [c[0] for c in coins]
    emit("coins", shell(
        "Crypto trading strategies by coin, live regime reads & paper trading | zengtrade",
        "Paper-trade regime-aware strategies on every major coin. Live prices, backtests, and a current market-regime read for each. Honest about every cost, non-custodial. Not investment advice.",
        "https://zengtrade.in/coins/", G.coin_hub_main(present)), "https://zengtrade.in/coins/")
    for sym, name, slug, cat, tk, closes in coins:
        title, desc, canon, cmain, extra = G.coin_parts(sym, name, slug, cat, tk, closes)
        emit(os.path.join("coins", slug), shell(title, desc, canon, cmain, extra_head=extra), canon)
        print("  ✓ /coins/%s/  ($%s, %s%% 24h)" % (slug, tk["lastPrice"], tk["priceChangePercent"]))

# Product routes (auth-gated but indexable landing/signup entry points for GSC)
urls.extend([
    "https://zengtrade.in/login",
    "https://zengtrade.in/app",
])

# ---- sitemap + robots ------------------------------------------------------------------
sm = ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + "".join(f"  <url><loc>{u}</loc><changefreq>daily</changefreq></url>\n" for u in urls)
      + "</urlset>\n")
open(os.path.join(DIST, "sitemap.xml"), "w").write(sm)
open(os.path.join(DIST, "robots.txt"), "w").write(
    "User-agent: *\nAllow: /\nSitemap: https://zengtrade.in/sitemap.xml\n")

print("built %d pages:" % len(urls), ", ".join(sorted(os.listdir(DIST))))
