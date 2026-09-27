#!/usr/bin/env python3
"""Programmatic SEO Blog Engine for zengtrade.

Generates 10,000 programmatic blog articles across 100 deep quantitative topics and 100 coins.
Topics cover Markets, Trading, Investing, Algo, and Strategies.
Strict adherence to zero em dashes (no \u2014 or —).
"""
import os
import json
import html
from concurrent.futures import ThreadPoolExecutor

from blog_engine_data import PILLARS, generate_topics

SITE = "https://zengtrade.in"

BLOG_CSS = """
/* Programmatic SEO Blog Engine CSS */
.blog-page{padding-bottom:60px}
.blog-hero{padding:48px 0 24px;text-align:left}
.blog-breadcrumbs{font-size:12px;color:var(--slate);margin-bottom:16px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.blog-breadcrumbs a{color:var(--slate);text-decoration:none}
.blog-breadcrumbs a:hover{color:var(--navy);text-decoration:underline}
.blog-breadcrumbs .active{color:var(--navy);font-weight:600}
.blog-pill{display:inline-block;padding:4px 10px;background:rgba(0,171,78,0.1);color:var(--accent);font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border-radius:20px;margin-bottom:14px}
.blog-meta{font-size:13px;color:var(--slate);margin:14px 0 24px;display:flex;gap:12px;align-items:center}
.blog-meta .dot{display:inline-block;width:4px;height:4px;background:var(--slate);border-radius:50%}
.blog-price-pill{display:inline-block;padding:6px 12px;background:var(--surface);border:1px solid var(--line);border-radius:12px;font-size:13px;font-weight:600;color:var(--navy)}
.blog-price-pill span{color:var(--accent)}
.blog-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:24px 0}
.blog-stat-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:20px}
.bsc-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--slate)}
.bsc-val{font-size:16px;font-weight:800;color:var(--navy);margin:6px 0 0}
.blog-body{padding:32px 0}
.blog-body h2{font-size:24px;font-weight:800;color:var(--navy);margin:40px 0 16px}
.blog-body h3{font-size:18px;font-weight:700;color:var(--navy);margin:24px 0 12px}
.blog-body p{font-size:15px;line-height:1.7;color:var(--navy);margin:0 0 16px}
.blog-body ul{margin:0 0 20px;padding-left:20px;font-size:15px;line-height:1.7;color:var(--navy)}
.blog-body li{margin-bottom:8px}
.formula-box{background:rgba(0,0,0,0.3);border:1px solid var(--line);border-radius:8px;padding:16px;margin:20px 0;overflow-x:auto}
.formula-box code{font-family:monospace;font-size:14px;color:var(--accent)}
.blog-eeat{background:rgba(0,171,78,0.04);border:1px solid rgba(0,171,78,0.25);border-radius:14px;padding:24px;margin-top:40px}
.eeat-badge{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;color:var(--accent);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px}
.blog-faq{margin-top:40px}
.faq-item{border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:12px;background:var(--surface)}
.faq-item summary{font-weight:700;font-size:15px;color:var(--navy);cursor:pointer}
.faq-item p{margin:12px 0 0;font-size:14px;color:var(--slate)}
.blog-hub-hero{text-align:center;padding:60px 0 40px}
.blog-search-bar{max-width:640px;margin:24px auto 0}
#blogSearchInput{width:100%;padding:14px 20px;background:var(--surface);border:1px solid var(--line);border-radius:12px;font-size:14px;color:var(--navy);outline:none;transition:all 0.15s}
#blogSearchInput:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(0,171,78,0.15)}
.blog-tabs{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:32px 0}
.blog-tab{padding:9px 18px;background:var(--surface);border:1px solid var(--line);border-radius:24px;font-size:13px;font-weight:600;color:var(--slate);cursor:pointer;transition:all 0.15s;text-decoration:none;display:inline-block}
.blog-tab:hover{color:var(--navy);border-color:var(--slate)}
.blog-tab.active{background:var(--accent);border-color:var(--accent);color:#04140a}
.blog-card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;margin-top:24px}
.blog-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:24px;text-decoration:none;display:flex;flex-direction:column;transition:transform 0.15s,box-shadow 0.15s}
.blog-card:hover{transform:translateY(-2px);border-color:var(--accent);box-shadow:var(--shadow-hover)}
.blog-card .bpill{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:var(--accent);margin-bottom:12px}
.blog-card h3{font-size:18px;font-weight:800;color:var(--navy);margin:0 0 10px;line-height:1.3}
.blog-card p{font-size:13px;color:var(--slate);line-height:1.5;margin:0 0 16px;flex-grow:1}
.blog-card .bfoot{font-size:12px;color:var(--slate-2);display:flex;justify-content:space-between}
@media(max-width:820px){.blog-grid3{grid-template-columns:1fr}}
"""

def safe_str(s: str) -> str:
    if not isinstance(s, str): return s
    return s.replace('\u2014', ' - ').replace('—', ' - ')

def get_coin_roster():
    p = os.path.join(os.path.dirname(__file__), "coin_data_cache.json")
    if os.path.exists(p):
        try:
            with open(p, "r", encoding="utf-8") as f:
                d = json.loads(f.read())
            return d.get("coins", [])
        except Exception:
            pass
    try:
        import generate as G
        return G.get_coin_data()
    except Exception:
        return []

def render_article(topic, coin, build_date):
    sym, name, slug, cat, tk, bars = coin
    p_f = float(tk["lastPrice"])
    if p_f >= 1: price_str = f"${p_f:,.2f}"
    elif p_f >= 0.01: price_str = f"${p_f:,.4f}"
    else: price_str = f"${p_f:,.6f}"

    chg = float(tk["priceChangePercent"])
    chg_str = f"+{chg}%" if chg >= 0 else f"{chg}%"

    t_slug = topic["slug"]
    pillar = topic["pillar"]
    pillar_name = PILLARS[pillar]
    raw_title = topic["title"].replace("{sym}", sym).replace("{name}", name)
    raw_hook = topic["hook"].replace("{sym}", sym).replace("{name}", name)
    
    title = safe_str(f"{raw_title} | zengtrade Blog")
    desc = safe_str(f"Deep dive into {raw_title}. Paper trade {name} strategies with live prices, 35 bps execution friction, and no custody risk.")
    canon = f"{SITE}/blog/{slug}-{t_slug}/"
    
    crumb = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"},
        {"@type": "ListItem", "position": 2, "name": "Blog", "item": f"{SITE}/blog/"},
        {"@type": "ListItem", "position": 3, "name": pillar_name, "item": f"{SITE}/blog/category/{pillar}/"},
        {"@type": "ListItem", "position": 4, "name": raw_title, "item": canon},
    ]}
    
    post_schema = {
        "@context": "https://schema.org", "@type": "BlogPosting",
        "headline": safe_str(raw_title), "description": desc,
        "datePublished": build_date,
        "author": {"@type": "Organization", "name": "zengtrade Quant Team"},
        "publisher": {"@type": "Organization", "name": "zengtrade", "url": SITE},
        "mainEntityOfPage": {"@type": "WebPage", "@id": canon}
    }
    
    faqs = [
        {"q": f"How do I paper trade {raw_title}?", "a": f"You can simulate {name} ({sym}) execution in zengtrade Algo Studio using live Binance spot prices. It natively bakes in 35 bps round-trip friction to give you an honest profit and loss readout."},
        {"q": f"What market regime is best for this {name} strategy?", "a": f"The optimal regime depends on underlying volatility. Our engine reads Bull, Neutral, and Bear macro regimes, forcing capital to stand down when {sym} lacks a clear statistical edge."},
        {"q": f"Does zengtrade charge trading fees for {sym}?", "a": "No. zengtrade is strictly non-custodial. You connect your own exchange API keys to execute live, and we take zero commission. Paper trading is completely free."}
    ]
    faq_schema = {
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": safe_str(f["q"]), "acceptedAnswer": {"@type": "Answer", "text": safe_str(f["a"])}} for f in faqs]
    }
    
    extra = (f'<script type="application/ld+json">{json.dumps(crumb)}</script>\n'
             f'<script type="application/ld+json">{json.dumps(post_schema)}</script>\n'
             f'<script type="application/ld+json">{json.dumps(faq_schema)}</script>')
             
    e = html.escape
    main_html = f"""<main id="main" class="blog-page">
  <section class="blog-hero" aria-labelledby="h-blog">
    <div class="lp-wrap">
      <nav class="blog-breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Home</a> &rsaquo; 
        <a href="/blog/">Blog</a> &rsaquo; 
        <a href="/blog/category/{pillar}/">{pillar_name}</a> &rsaquo; 
        <span class="active">{e(raw_title)}</span>
      </nav>
      <div class="blog-pill">{pillar_name} &bull; {cat.upper()}</div>
      <h1 id="h-blog" class="lp-h1">{e(raw_title)}</h1>
      <p class="lp-sub" style="max-width:800px">{e(raw_hook)} {e(desc)}</p>
      
      <div class="blog-meta">
        <span>zengtrade Quant Team</span><span class="dot"></span><span>5 min read</span><span class="dot"></span><span>{build_date}</span>
      </div>
      
      <div class="blog-price-pill">
        Live Tape: {name} ({sym}) {price_str} <span>{chg_str} 24h</span>
      </div>
      
      <div class="blog-grid3">
        <div class="blog-stat-card"><div class="bsc-label">Execution Model</div><div class="bsc-val">Paper &amp; Live Spot</div></div>
        <div class="blog-stat-card"><div class="bsc-label">Friction Engine</div><div class="bsc-val">35 bps Round-Trip</div></div>
        <div class="blog-stat-card"><div class="bsc-label">Custody Risk</div><div class="bsc-val">Zero (Non-Custodial)</div></div>
      </div>
    </div>
  </section>

  <section class="blog-body">
    <div class="lp-wrap" style="max-width:800px; margin:0 auto">
      <h2>Understanding {e(raw_title)}</h2>
      <p>Institutional execution in the {name} market is defined by raw quantitative mechanics. While retail volume chases late momentum, systematic algorithms exploit statistical inefficiencies. The key to mastering {e(raw_title)} lies in objective, regime-aware capital deployment.</p>
      <p>Whether {sym} is trapped in a tight consolidation range or experiencing a violent liquidity expansion, deploying capital without a strict mathematical governor is equivalent to gambling. zengtrade's engine isolates these exact market states.</p>
      
      <h3>The Core Mechanics</h3>
      <p>Trading {name} requires factoring in extreme volatility and high-frequency order book spoofing. A robust approach must account for:</p>
      <ul>
        <li><strong>Slippage &amp; Spread:</strong> Factoring in a minimum 35 bps friction threshold for every round-trip execution.</li>
        <li><strong>Regime Filters:</strong> Mandating capital preservation by standing down when the {sym} macro regime opposes the strategy thesis.</li>
        <li><strong>Drawdown Limits:</strong> Absolute circuit breakers tied to portfolio risk, never emotional conviction.</li>
      </ul>
      
      <div class="formula-box">
        <code>Net Expected Value = (Win Probability * Avg {sym} Profit) - (Loss Probability * Avg {sym} Loss) - (35 bps Friction)</code>
      </div>

      <h3>Simulate in Algo Studio</h3>
      <p>Before risking a single dollar on a live exchange, you can prove this strategy's edge in zengtrade Algo Studio.</p>
      <p>The worker runs every 5 minutes, reading the live Binance spot tape for {sym}. It executes paper trades precisely as it would in production, applying full fee models and strict regime governors. If the {name} strategy survives paper trading across Bull, Neutral, and Bear phases, it earns the right to go live.</p>
      
      <div class="blog-eeat">
        <div class="eeat-badge"><span>✓</span> Transparent &amp; Honest Analytics</div>
        <p>zengtrade is engineered for survival first. We will never show you a simulated 100x return without deducting trading costs. Every backtest and forward test includes 35 bps round-trip friction and strict regime-aware filters. We do not hold your funds. Start paper trading {sym} securely today.</p>
      </div>
      
      <div class="blog-faq">
        <h3>Frequently Asked Questions</h3>
        {"".join(f'<details class="faq-item"><summary>{e(f["q"])}</summary><p>{e(f["a"])}</p></details>' for f in faqs)}
      </div>
      
      <div class="lp-cta-row center" style="margin-top:48px">
        <a class="lp-cta primary" href="/login/?mode=signup&amp;utm_source=seo&amp;utm_medium=organic&amp;utm_campaign=blog_{slug}_{t_slug}">Paper-Trade {sym} Free</a>
        <a class="lp-cta ghost" href="/blog/">Back to Blog Hub</a>
      </div>
    </div>
  </section>
</main>"""
    return title, desc, canon, main_html, extra


def render_hub(topics, coins, build_date):
    title = "zengtrade Blog | Quantitative Crypto Trading Analysis"
    desc = "Honest, quantitative analysis on crypto markets, algorithmic trading, and systematic strategies. No hype, just data-driven edge."
    canon = f"{SITE}/blog/"
    
    crumb = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"},
        {"@type": "ListItem", "position": 2, "name": "Blog", "item": canon},
    ]}
    
    extra = f'<script type="application/ld+json">{json.dumps(crumb)}</script>'
    
    e = html.escape
    featured = []
    for idx in range(min(18, len(topics))):
        t = topics[idx]
        c = coins[idx % len(coins)]
        sym, name, slug, cat, tk, bars = c
        raw_title = t["title"].replace("{sym}", sym).replace("{name}", name)
        featured.append(f"""
        <a class="blog-card" href="/blog/{slug}-{t['slug']}/" data-pillar="{t['pillar']}" data-cat="{cat}">
          <span class="bpill">{PILLARS[t['pillar']]}</span>
          <h3>{e(raw_title)}</h3>
          <p>{e(t['hook'].replace("{sym}", sym).replace("{name}", name))}</p>
          <div class="bfoot"><span>{name} ({sym})</span><span>5 min read</span></div>
        </a>""")
        
    grid_html = "".join(featured)
    
    main_html = f"""<main id="main" class="blog-page">
  <section class="blog-hub-hero" aria-labelledby="h-blog">
    <div class="lp-wrap">
      <div class="blog-pill">Quantitative Research</div>
      <h1 id="h-blog" class="lp-h1">The zengtrade Blog</h1>
      <p class="lp-sub">Data-driven analysis on algorithms, regimes, and market mechanics.</p>
      
      <div class="blog-search-bar">
        <input type="text" id="blogSearchInput" placeholder="Search strategies, coins, or market mechanics..." autocomplete="off">
      </div>
      
      <div class="blog-tabs">
        <a href="/blog/" class="blog-tab active">All Topics</a>
        <a href="/blog/category/markets/" class="blog-tab">Markets</a>
        <a href="/blog/category/trading/" class="blog-tab">Trading</a>
        <a href="/blog/category/investing/" class="blog-tab">Investing</a>
        <a href="/blog/category/algo/" class="blog-tab">Algo</a>
        <a href="/blog/category/strategies/" class="blog-tab">Strategies</a>
      </div>
    </div>
  </section>

  <section class="blog-body">
    <div class="lp-wrap">
      <h2 style="margin-top:0">Featured Analysis</h2>
      <div class="blog-card-grid" id="blogCardGrid">
        {grid_html}
      </div>
      <div class="lp-cta-row center" style="margin-top:40px">
        <a class="lp-cta ghost" href="/sitemap/">View Full Directory</a>
      </div>
    </div>
  </section>
</main>
<script>
document.getElementById('blogSearchInput').addEventListener('input', function(e) {{
    var term = e.target.value.toLowerCase();
    var cards = document.querySelectorAll('.blog-card');
    cards.forEach(function(c) {{
        var text = c.textContent.toLowerCase();
        c.style.display = text.indexOf(term) > -1 ? 'flex' : 'none';
    }});
}});
</script>"""
    return title, desc, canon, main_html, extra


def render_category(pillar_key, topics, coins, build_date):
    pillar_name = PILLARS[pillar_key]
    title = f"{pillar_name} | zengtrade Blog"
    desc = f"Deep dive into {pillar_name}. Master algorithmic systems, regime-aware logic, and quantitative execution models."
    canon = f"{SITE}/blog/category/{pillar_key}/"
    
    crumb = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"},
        {"@type": "ListItem", "position": 2, "name": "Blog", "item": f"{SITE}/blog/"},
        {"@type": "ListItem", "position": 3, "name": pillar_name, "item": canon},
    ]}
    
    extra = f'<script type="application/ld+json">{json.dumps(crumb)}</script>'
    
    e = html.escape
    pillar_topics = [t for t in topics if t["pillar"] == pillar_key]
    featured = []
    
    for idx, t in enumerate(pillar_topics):
        c = coins[idx % len(coins)]
        sym, name, slug, cat, tk, bars = c
        raw_title = t["title"].replace("{sym}", sym).replace("{name}", name)
        featured.append(f"""
        <a class="blog-card" href="/blog/{slug}-{t['slug']}/">
          <span class="bpill">{name} ({sym})</span>
          <h3>{e(raw_title)}</h3>
          <p>{e(t['hook'].replace("{sym}", sym).replace("{name}", name))}</p>
          <div class="bfoot"><span>{pillar_name}</span><span>5 min read</span></div>
        </a>""")
        
    grid_html = "".join(featured)
    
    main_html = f"""<main id="main" class="blog-page">
  <section class="blog-hub-hero" aria-labelledby="h-cat">
    <div class="lp-wrap">
      <nav class="blog-breadcrumbs" style="justify-content:center" aria-label="Breadcrumb">
        <a href="/">Home</a> &rsaquo; 
        <a href="/blog/">Blog</a> &rsaquo; 
        <span class="active">{pillar_name}</span>
      </nav>
      <h1 id="h-cat" class="lp-h1">{pillar_name}</h1>
      <p class="lp-sub">Data-driven analysis and quantitative models.</p>
    </div>
  </section>

  <section class="blog-body">
    <div class="lp-wrap">
      <div class="blog-card-grid">
        {grid_html}
      </div>
      <div class="lp-cta-row center" style="margin-top:40px">
        <a class="lp-cta ghost" href="/blog/">Back to All Topics</a>
      </div>
    </div>
  </section>
</main>"""
    return title, desc, canon, main_html, extra


def build_blog(dist_dir, shell_func, sample_only=False, coins=None):
    topics = generate_topics()
    if coins is None:
        coins = get_coin_roster()
    if sample_only:
        coins = coins[:5]  # drastically reduce scope for fast tests
        
    build_date = "2026-09-22"
    
    urls = []
    category_urls = []
    article_urls = []
    
    tasks = []
    
    def minify_html(raw: str) -> str:
        raw = raw.replace('\u2014', ' - ').replace('—', ' - ')
        lines = [line.strip() for line in raw.splitlines() if line.strip()]
        return "\n".join(lines)

    def write_page(out_dir: str, content: str):
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8") as f:
            f.write(minify_html(content))

    def process_and_write(out_d, title, desc, canon, mhtml, extra):
        html_str = shell_func(title, desc, canon, mhtml, extra_head=extra)
        write_page(out_d, html_str)

    with ThreadPoolExecutor(max_workers=16) as ex:
        futures = []
        
        # root blog index is now generated by content/blog.py (editorial hub)
        # we only generate the programmatic category hubs and the articles themselves
        for pk in PILLARS.keys():
            ctitle, cdesc, ccanon, cmain, cextra = render_category(pk, topics, coins, build_date)
            out_d = os.path.join(dist_dir, "blog", "category", pk)
            futures.append(ex.submit(process_and_write, out_d, ctitle, cdesc, ccanon, cmain, cextra))
            category_urls.append(ccanon)
            
        for topic in topics:
            if sample_only:
                c = coins[0]
                atitle, adesc, acanon, amain, aextra = render_article(topic, c, build_date)
                out_d = os.path.join(dist_dir, "blog", f"{c[2]}-{topic['slug']}")
                futures.append(ex.submit(process_and_write, out_d, atitle, adesc, acanon, amain, aextra))
                article_urls.append(acanon)
                continue
                
            for c in coins[:100]:
                atitle, adesc, acanon, amain, aextra = render_article(topic, c, build_date)
                out_d = os.path.join(dist_dir, "blog", f"{c[2]}-{topic['slug']}")
                futures.append(ex.submit(process_and_write, out_d, atitle, adesc, acanon, amain, aextra))
                article_urls.append(acanon)
    
        print(f"Emitting {len(futures)} Blog SEO pages into dist...")
        for future in futures:
            future.result()
        
    if not sample_only:
        MAX_CHUNK = 5000
        all_sitemaps = []
        chunks = [article_urls[i:i + MAX_CHUNK] for i in range(0, len(article_urls), MAX_CHUNK)]
        for part_idx, chunk in enumerate(chunks, 1):
            if part_idx == len(chunks):
                chunk.extend(category_urls)
            sm_filename = f"sitemap-blog-{part_idx}.xml"
            all_sitemaps.append(f"{SITE}/{sm_filename}")
            xml_body = ['<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n']
            for u in chunk:
                xml_body.append(f"  <url><loc>{u}</loc><lastmod>{build_date}</lastmod><changefreq>weekly</changefreq></url>\n")
            xml_body.append("</urlset>\n")
            with open(os.path.join(dist_dir, sm_filename), "w", encoding="utf-8") as f:
                f.write("".join(xml_body))
            print(f"  ✓ {sm_filename} ({len(chunk)} URLs)")
            
        return urls + category_urls + article_urls, all_sitemaps
    else:
        return urls + category_urls + article_urls, []
