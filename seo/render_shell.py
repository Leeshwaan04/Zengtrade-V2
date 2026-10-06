import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
LANDING_DIR = os.path.abspath(os.path.join(HERE, "..", "deploy", "landing"))
SRC_HTML_PATH = os.path.join(LANDING_DIR, "index.html")

_SHELL_CACHE = None

def _init_shell():
    global _SHELL_CACHE
    if _SHELL_CACHE is not None:
        return _SHELL_CACHE

    src = open(SRC_HTML_PATH, "r", encoding="utf-8").read()

    def between(s, a, b):
        return s[s.index(a): s.index(b) + len(b)]

    css = src[src.index("<style>") + 7: src.index("</style>")]
    prebody = src[src.index("<body>") + len("<body>"): src.index('<header class="topbar">')]
    chrome = between(src, '<header class="topbar">', '<main id="main">').rsplit('<main id="main">', 1)[0]
    tail = src[src.index("</main>") + len("</main>"): src.index("</body>")]
    tail = re.sub(r'<script[^>]*>.*?</script>', '', tail, flags=re.DOTALL)
    tail += '\n<script src="/site.js" defer></script>'

    def absolutize(x):
        x = x.replace('href="assets/', 'href="/assets/').replace('src="assets/', 'src="/assets/')
        x = x.replace('url(assets/', 'url(/assets/').replace('"assets/mascot-', '"/assets/mascot-')
        x = x.replace("'assets/mascot-", "'/assets/mascot-")
        x = x.replace('//assets/', '/assets/')
        x = x.replace('alt=""', 'alt="zengtrade Bull Market Mascot"')
        return x

    css, prebody, chrome, tail = map(absolutize, (css, prebody, chrome, tail))

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

    _FONTS_URL = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Roboto+Mono:wght@400;500;600&display=swap"
    fonts = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
             '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
             '<link rel="preconnect" href="https://data-api.binance.vision" crossorigin>'
             f'<link rel="preload" as="style" href="{_FONTS_URL}">'
             f'<link href="{_FONTS_URL}" rel="stylesheet" media="print" onload="this.media=\'all\'">'
             f'<noscript><link rel="stylesheet" href="{_FONTS_URL}"></noscript>')

    ga = """<script async src="https://www.googletagmanager.com/gtag/js?id=G-HTP82WBWMH"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-HTP82WBWMH');
</script>"""

    beacon = """<script>
(function(){try{
  var u=new URLSearchParams(location.search),bits=[];
  ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","gclid"].forEach(function(k){var v=u.get(k);if(v)bits.push(k+"="+v);});
  var path=location.pathname.slice(0,220)+(bits.length?"?"+bits.join("&"):"");
  fetch("https://ponvarxeytfcntckczbn.supabase.co/rest/v1/event",{method:"POST",
    headers:{apikey:"sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1","Content-Type":"application/json",Prefer:"return=minimal"},
    body:JSON.stringify({name:"pageview",path:path.slice(0,290),ref:(document.referrer||"").slice(0,290)}),
    keepalive:true
  }).catch(function(){});
}catch(e){}})();
</script>"""

    _SHELL_CACHE = (prebody, chrome, tail, fonts, ga, beacon)
    return _SHELL_CACHE


def render_shell(title, desc, canon, main, extra_head=""):
    prebody, chrome, tail, fonts, ga, beacon = _init_shell()
    return f"""<!DOCTYPE html><html lang="en" data-regime="bull"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="google-site-verification" content="4PH6tBz21xuJcfMqEBPBNHeAnsjUgybfawZpg8sYLc0">
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
{fonts}
<link rel="stylesheet" href="/site.css">{extra_head}
{ga}
</head><body>
{prebody}
{chrome}
{main}
{tail}
{beacon}
</body></html>"""
