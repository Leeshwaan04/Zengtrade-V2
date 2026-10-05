#!/usr/bin/env python3
"""Zengtrade Real-Time SSR Server for Cloud Run.

Serves 300,000+ programmatic SEO articles, systematic strategy hubs,
technical indicators, and coin pages with real-time server rendering (<10ms)
and dynamic XML sitemaps.
"""
from __future__ import annotations

import os
import sys
import time
from typing import Optional

from fastapi import FastAPI, Request, Response
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import seo.generate as G
from seo.render_shell import render_shell
import seo.pseo_engine as pseo
import seo.blog_engine as blog

DIST_DIR = os.path.join(HERE, "deploy", "landing", "dist")
SAAS_WEB_DIR = os.path.join(HERE, "saas", "web")
ASSETS_DIR = os.path.join(HERE, "assets")

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

# Pre-load roster & topics into memory on startup
cache_data = G._load_cache() or {}
base_coins = cache_data.get("coins", [])
COIN_ROSTER = pseo.build_pseo_coin_roster(base_coins, target_count=1000)
COIN_BY_SLUG = {c[2]: c for c in base_coins}
TOPICS = blog.get_topics_by_slug()

print(f"✓ Initialized Zengtrade SSR Server: {len(COIN_ROSTER)} coins, {len(TOPICS)} blog topics.")


# Cache sitemap URLs in memory for instantaneous streaming
_BLOG_URLS = None
def get_all_blog_urls():
    global _BLOG_URLS
    if _BLOG_URLS is None:
        _BLOG_URLS = []
        for t in TOPICS:
            t_slug = t["slug"]
            for c in COIN_ROSTER:
                _BLOG_URLS.append(f"https://zengtrade.in/blog/{c[2]}-{t_slug}/")
    return _BLOG_URLS

_STRAT_URLS = None
def get_all_strat_urls():
    global _STRAT_URLS
    if _STRAT_URLS is None:
        _STRAT_URLS = []
        for s in pseo.STRATEGIES:
            s_slug = s["slug"]
            for c in COIN_ROSTER:
                c_slug = c[2]
                _STRAT_URLS.append(f"https://zengtrade.in/strategies/{s_slug}/{c_slug}/")
                for tf in pseo.TIMEFRAMES:
                    _STRAT_URLS.append(f"https://zengtrade.in/strategies/{s_slug}/{c_slug}/{tf['slug']}/")
    return _STRAT_URLS

_IND_URLS = None
def get_all_ind_urls():
    global _IND_URLS
    if _IND_URLS is None:
        _IND_URLS = []
        for i in pseo.INDICATORS:
            i_slug = i["slug"]
            for c in COIN_ROSTER:
                c_slug = c[2]
                _IND_URLS.append(f"https://zengtrade.in/indicators/{i_slug}/{c_slug}/")
                for tf in pseo.TIMEFRAMES:
                    _IND_URLS.append(f"https://zengtrade.in/indicators/{i_slug}/{c_slug}/{tf['slug']}/")
    return _IND_URLS

_REGIME_URLS = None
def get_all_regime_urls():
    global _REGIME_URLS
    if _REGIME_URLS is None:
        _REGIME_URLS = []
        for r in pseo.REGIMES:
            r_slug = r["slug"]
            for c in COIN_ROSTER:
                _REGIME_URLS.append(f"https://zengtrade.in/regimes/{r_slug}/{c[2]}/")
    return _REGIME_URLS

_COMPARE_URLS = None
def get_all_compare_urls():
    global _COMPARE_URLS
    if _COMPARE_URLS is None:
        _COMPARE_URLS = []
        for s in pseo.SHOWDOWNS:
            s_slug = s["slug"]
            for c in COIN_ROSTER:
                _COMPARE_URLS.append(f"https://zengtrade.in/compare/{s_slug}/{c[2]}/")
    return _COMPARE_URLS


# Mount static assets
if os.path.isdir(os.path.join(DIST_DIR, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="assets")
elif os.path.isdir(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


@app.middleware("http")
async def add_security_and_cache_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Content-Security-Policy"] = "frame-ancestors 'none'"
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return resp


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "zengtrade-ssr", "coins": len(COIN_ROSTER)}


@app.get("/robots.txt")
def robots():
    rb_path = os.path.join(DIST_DIR, "robots.txt")
    if not os.path.exists(rb_path):
        rb_path = os.path.join(HERE, "robots.txt")
    if os.path.exists(rb_path):
        content = open(rb_path, "r", encoding="utf-8").read()
        return PlainTextResponse(content, media_type="text/plain")
    return PlainTextResponse("User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /ops/\nDisallow: /admin/\nSitemap: https://zengtrade.in/sitemap-index.xml\n")


# ---- DYNAMIC REAL-TIME SITEMAPS (ALL 393,000+ URLS) --------------------------------------

def _build_urlset(urls):
    if not urls:
        return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
    xml_parts = ['<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n']
    for u in urls:
        xml_parts.append(f"  <url><loc>{u}</loc><lastmod>2026-10-05</lastmod><changefreq>weekly</changefreq></url>\n")
    xml_parts.append("</urlset>\n")
    return "".join(xml_parts)


@app.get("/sitemap-index.xml")
def sitemap_index():
    xml = """<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://zengtrade.in/sitemap-core.xml</loc><lastmod>2026-10-05</lastmod></sitemap>
  <sitemap><loc>https://zengtrade.in/sitemap-coins.xml</loc><lastmod>2026-10-05</lastmod></sitemap>
  <sitemap><loc>https://zengtrade.in/sitemap-regimes.xml</loc><lastmod>2026-10-05</lastmod></sitemap>
  <sitemap><loc>https://zengtrade.in/sitemap-compare.xml</loc><lastmod>2026-10-05</lastmod></sitemap>
  <sitemap><loc>https://zengtrade.in/sitemap-strategies-1.xml</loc><lastmod>2026-10-05</lastmod></sitemap>
  <sitemap><loc>https://zengtrade.in/sitemap-strategies-2.xml</loc><lastmod>2026-10-05</lastmod></sitemap>
  <sitemap><loc>https://zengtrade.in/sitemap-strategies-3.xml</loc><lastmod>2026-10-05</lastmod></sitemap>
  <sitemap><loc>https://zengtrade.in/sitemap-strategies-4.xml</loc><lastmod>2026-10-05</lastmod></sitemap>
  <sitemap><loc>https://zengtrade.in/sitemap-indicators-1.xml</loc><lastmod>2026-10-05</lastmod></sitemap>
  <sitemap><loc>https://zengtrade.in/sitemap-indicators-2.xml</loc><lastmod>2026-10-05</lastmod></sitemap>
  <sitemap><loc>https://zengtrade.in/sitemap-indicators-3.xml</loc><lastmod>2026-10-05</lastmod></sitemap>
  <sitemap><loc>https://zengtrade.in/sitemap-indicators-4.xml</loc><lastmod>2026-10-05</lastmod></sitemap>
  <sitemap><loc>https://zengtrade.in/sitemap-blog-1.xml</loc><lastmod>2026-10-05</lastmod></sitemap>
  <sitemap><loc>https://zengtrade.in/sitemap-blog-2.xml</loc><lastmod>2026-10-05</lastmod></sitemap>
  <sitemap><loc>https://zengtrade.in/sitemap-blog-3.xml</loc><lastmod>2026-10-05</lastmod></sitemap>
  <sitemap><loc>https://zengtrade.in/sitemap-blog-4.xml</loc><lastmod>2026-10-05</lastmod></sitemap>
  <sitemap><loc>https://zengtrade.in/sitemap-blog-5.xml</loc><lastmod>2026-10-05</lastmod></sitemap>
  <sitemap><loc>https://zengtrade.in/sitemap-blog-6.xml</loc><lastmod>2026-10-05</lastmod></sitemap>
  <sitemap><loc>https://zengtrade.in/sitemap-blog-7.xml</loc><lastmod>2026-10-05</lastmod></sitemap>
  <sitemap><loc>https://zengtrade.in/sitemap-blog-8.xml</loc><lastmod>2026-10-05</lastmod></sitemap>
</sitemapindex>"""
    return Response(content=xml, media_type="application/xml", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/sitemap-blog-{part}.xml")
def sitemap_blog_part(part: int):
    all_urls = get_all_blog_urls()
    max_chunk = 25000
    start = (part - 1) * max_chunk
    chunk = all_urls[start : start + max_chunk]
    return Response(content=_build_urlset(chunk), media_type="application/xml", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/sitemap-strategies-{part}.xml")
def sitemap_strategies_part(part: int):
    all_urls = get_all_strat_urls()
    max_chunk = 25000
    start = (part - 1) * max_chunk
    chunk = all_urls[start : start + max_chunk]
    return Response(content=_build_urlset(chunk), media_type="application/xml", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/sitemap-indicators-{part}.xml")
def sitemap_indicators_part(part: int):
    all_urls = get_all_ind_urls()
    max_chunk = 25000
    start = (part - 1) * max_chunk
    chunk = all_urls[start : start + max_chunk]
    return Response(content=_build_urlset(chunk), media_type="application/xml", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/sitemap-regimes.xml")
def sitemap_regimes():
    all_urls = get_all_regime_urls()
    return Response(content=_build_urlset(all_urls), media_type="application/xml", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/sitemap-compare.xml")
def sitemap_compare():
    all_urls = get_all_compare_urls()
    return Response(content=_build_urlset(all_urls), media_type="application/xml", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/sitemap-coins.xml")
def sitemap_coins():
    urls = ["https://zengtrade.in/coins/"]
    for c in base_coins:
        urls.append(f"https://zengtrade.in/coins/{c[2]}/")
    return Response(content=_build_urlset(urls), media_type="application/xml", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/sitemap-core.xml")
def sitemap_core():
    urls = [
        "https://zengtrade.in/",
        "https://zengtrade.in/how-it-works/",
        "https://zengtrade.in/pricing/",
        "https://zengtrade.in/coins/",
        "https://zengtrade.in/blog/",
        "https://zengtrade.in/dashboard/",
        "https://zengtrade.in/app",
        "https://zengtrade.in/login",
        "https://zengtrade.in/contact",
        "https://zengtrade.in/privacy",
        "https://zengtrade.in/terms",
        "https://zengtrade.in/risk",
    ]
    return Response(content=_build_urlset(urls), media_type="application/xml", headers={"Cache-Control": "public, max-age=86400"})


# Serve other sitemaps directly from DIST if present
@app.get("/{sitemap_name:str}.xml")
def static_sitemap(sitemap_name: str):
    sm_file = os.path.join(DIST_DIR, f"{sitemap_name}.xml")
    if os.path.isfile(sm_file):
        content = open(sm_file, "r", encoding="utf-8").read()
        return Response(content=content, media_type="application/xml", headers={"Cache-Control": "public, max-age=86400"})
    return Response(status_code=404)


# ---- CORE APPS & SPA PAGES ------------------------------------------------------------

@app.get("/site.css")
def site_css():
    p = os.path.join(DIST_DIR, "site.css")
    if os.path.exists(p):
        return Response(content=open(p, "r", encoding="utf-8").read(), media_type="text/css", headers={"Cache-Control": "public, max-age=31536000, immutable"})
    return Response(status_code=404)

@app.get("/site.js")
def site_js():
    p = os.path.join(DIST_DIR, "site.js")
    if os.path.exists(p):
        return Response(content=open(p, "r", encoding="utf-8").read(), media_type="application/javascript", headers={"Cache-Control": "public, max-age=31536000, immutable"})
    return Response(status_code=404)

@app.get("/app")
def app_page():
    p = os.path.join(SAAS_WEB_DIR, "app.html")
    return HTMLResponse(open(p, "r", encoding="utf-8").read())

@app.get("/login")
def login_page():
    p = os.path.join(SAAS_WEB_DIR, "login.html")
    return HTMLResponse(open(p, "r", encoding="utf-8").read())

@app.get("/reset")
def reset_page():
    p = os.path.join(SAAS_WEB_DIR, "reset.html")
    return HTMLResponse(open(p, "r", encoding="utf-8").read())

@app.get("/dashboard")
def dashboard_page():
    p = os.path.join(DIST_DIR, "dashboard", "index.html")
    if not os.path.exists(p):
        p = os.path.join(HERE, "index.html")
    return HTMLResponse(open(p, "r", encoding="utf-8").read())


# ---- DYNAMIC ROUTE RESOLVER (REAL-TIME SSR FOR ALL 300,000 PAGES) ----------------------

@app.get("/{full_path:path}")
def catch_all(request: Request, full_path: str):
    clean = full_path.strip("/")

    # 1. Root / Home
    if clean in ("", "index.html"):
        p = os.path.join(DIST_DIR, "index.html")
        if os.path.isfile(p):
            return HTMLResponse(open(p, "r", encoding="utf-8").read(), headers={"Cache-Control": "public, max-age=3600"})

    # 2. Exact match in DIST (pre-rendered core pages: pricing, how-it-works, coins, etc.)
    p_dist_idx = os.path.join(DIST_DIR, clean, "index.html")
    if os.path.isfile(p_dist_idx):
        return HTMLResponse(open(p_dist_idx, "r", encoding="utf-8").read(), headers={"Cache-Control": "public, max-age=86400"})
    
    p_dist_file = os.path.join(DIST_DIR, clean)
    if os.path.isfile(p_dist_file):
        content_type = "text/html"
        if clean.endswith(".json"): content_type = "application/json"
        elif clean.endswith(".svg"): content_type = "image/svg+xml"
        return Response(content=open(p_dist_file, "rb").read(), media_type=content_type)

    # 3. Exact match in saas/web/ (e.g. contact.html, terms.html, privacy.html, ops.html)
    p_saas = os.path.join(SAAS_WEB_DIR, clean + ".html")
    if os.path.isfile(p_saas):
        return HTMLResponse(open(p_saas, "r", encoding="utf-8").read(), headers={"Cache-Control": "public, max-age=86400"})

    # 4. Real-time SSR: Blog Engine (/blog, /blog/, /blog/category/* and /blog/*)
    if clean == "blog":
        p_blog = os.path.join(DIST_DIR, "blog", "index.html")
        if os.path.isfile(p_blog):
            return HTMLResponse(open(p_blog, "r", encoding="utf-8").read(), headers={"Cache-Control": "public, max-age=86400"})
        html = blog.resolve_blog_page("blog/category/crypto-trading-strategies", render_shell, COIN_ROSTER)
        if html:
            return HTMLResponse(html, headers={"Cache-Control": "public, max-age=86400"})

    if clean.startswith("blog/"):
        html = blog.resolve_blog_page(clean, render_shell, COIN_ROSTER)
        if html:
            return HTMLResponse(html, headers={"Cache-Control": "public, max-age=86400, s-maxage=604800"})

    # 4b. Real-time SSR: Coins Hub & Coin Detail Pages (/coins, /coins/{coin})
    if clean == "coins":
        p_coins = os.path.join(DIST_DIR, "coins", "index.html")
        if os.path.isfile(p_coins):
            return HTMLResponse(open(p_coins, "r", encoding="utf-8").read(), headers={"Cache-Control": "public, max-age=86400"})
        present = [c[0] for c in base_coins]
        title = "Crypto Trading Strategies by Coin | zengtrade"
        desc = "Paper-trade regime-aware strategies on 150+ coins, grouped by category: DeFi, layer-1, meme, and more. Live prices, a real regime read. Non-custodial."
        canon = "https://zengtrade.in/coins/"
        mhtml = G.coin_hub_main(present)
        extra = G.coin_hub_schema(present)
        return HTMLResponse(render_shell(title, desc, canon, mhtml, extra_head=extra), headers={"Cache-Control": "public, max-age=86400"})

    if clean.startswith("coins/"):
        slug = clean.split("/")[1]
        if slug in COIN_BY_SLUG:
            title, desc, canon, cmain, extra = G.coin_parts(*COIN_BY_SLUG[slug])
            return HTMLResponse(render_shell(title, desc, canon, cmain, extra_head=extra), headers={"Cache-Control": "public, max-age=86400, s-maxage=604800"})

    # 5. Real-time SSR: pSEO Strategies, Indicators, Regimes, Timeframes, Comparisons
    if clean.startswith(("strategies/", "indicators/", "regimes/", "compare/")):
        html = pseo.resolve_pseo_page(clean, render_shell, COIN_ROSTER)
        if html:
            return HTMLResponse(html, headers={"Cache-Control": "public, max-age=86400, s-maxage=604800"})

    # 6. Fallback 404
    p_404 = os.path.join(DIST_DIR, "404.html")
    if os.path.isfile(p_404):
        return HTMLResponse(open(p_404, "r", encoding="utf-8").read(), status_code=404)

    return HTMLResponse("<h1>404 Not Found</h1>", status_code=404)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8011"))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
