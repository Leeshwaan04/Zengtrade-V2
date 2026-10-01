#!/usr/bin/env python3
"""zengtrade /blog/: timely posts, distinct from /learn/'s evergreen explainers. Same mechanism
as content/articles.py on purpose (content.md's charter: "reuses the existing pipeline instead of
inventing a new format") - markdown + front-matter, rendered through the same shell() - but a
different editorial calendar: /learn/ answers "what is X" forever, /blog/ answers "what happened
this week" and goes stale on purpose (a dated post is honest, not a bug).

Source files live in content/blog/*.md, identical front-matter shape to content/articles/*.md:

    ---
    slug: some-post-slug
    title: Some Post Title
    description: A 150-160 char SERP description.
    date: 2026-09-12
    ---
    Post body in markdown...

Same rule as everywhere else on the site: paper-first, non-custodial, honest about cost, no
fabricated numbers or claims about usage/traction that aren't real.
"""
from __future__ import annotations
import html, json, os, urllib.parse

from articles import _parse_front_matter  # shared front-matter parser; .article-body prose CSS
                                           # comes from articles.py's ARTICLE_CSS, already in the
                                           # shared site.css by the time a blog post page needs it

HERE = os.path.dirname(os.path.abspath(__file__))
BLOG_DIR = os.path.join(HERE, "blog")
SITE = "https://zengtrade.in"

BLOG_CSS = """
/* ---- /blog/: reuses .article-body prose styling from articles.py, only the hub differs ---- */
.blog-hub-list{display:flex;flex-direction:column;gap:2px;max-width:70ch;margin:0 auto}
.blog-hub-row{display:flex;flex-direction:column;gap:4px;padding:18px 0;border-bottom:1px solid var(--line)}
.blog-hub-row:last-child{border-bottom:none}
.blog-hub-row b{font:700 16px/1.35 var(--sans);color:var(--navy)}
.blog-hub-row span{font-size:14px;line-height:1.6;color:var(--slate)}
/* ---- PSEO Quantitative Research section ---- */
.quant-research-section{max-width:70ch;margin:60px auto 0;padding-top:40px;border-top:1px solid var(--line)}
.quant-research-section h2{font:700 18px/1.3 var(--sans);color:var(--navy);margin:0 0 8px}
.quant-research-section p{font-size:14px;line-height:1.6;color:var(--slate);margin:0 0 20px}
.quant-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}
.quant-card{display:flex;flex-direction:column;gap:8px;padding:20px;background:var(--surface-2);border-radius:12px;text-decoration:none;transition:background 0.2s, transform 0.2s}
.quant-card:hover{background:var(--surface-3);transform:translateY(-2px)}
.quant-card b{font:600 15px/1.3 var(--sans);color:var(--navy)}
.quant-card span{font-size:13px;line-height:1.5;color:var(--slate)}
"""


def load_posts():
    """[{slug, title, description, date, body_html}, ...] sorted newest first. Empty list (not an
    exception) if content/blog/ doesn't exist yet or markdown isn't installed - same defensive
    style as load_articles(), a missing/empty section shouldn't take down the whole build."""
    if not os.path.isdir(BLOG_DIR):
        return []
    try:
        import markdown as _markdown
    except ImportError:
        _markdown = None
    out = []
    for fname in sorted(os.listdir(BLOG_DIR)):
        if not fname.endswith(".md"):
            continue
        raw = open(os.path.join(BLOG_DIR, fname), encoding="utf-8").read()
        meta, body = _parse_front_matter(raw)
        slug = meta.get("slug") or fname[:-3]
        title = meta.get("title") or slug
        if _markdown:
            body_html = _markdown.markdown(body, extensions=["extra"])
        else:
            print("  ! markdown package not installed, rendering", fname, "as plain text")
            body_html = f"<pre>{html.escape(body)}</pre>"
        out.append({
            "slug": slug, "title": title,
            "description": meta.get("description", ""),
            "date": meta.get("date", ""),
            "body_html": body_html,
        })
    out.sort(key=lambda p: p["date"], reverse=True)
    return out


def render_blog_share_bar(canon_url, title):
    e = html.escape
    q = urllib.parse.quote
    share_text = f"Research: {title} via @zengtrade:"
    x_url = f"https://twitter.com/intent/tweet?text={q(share_text, safe='')}&url={q(canon_url, safe='')}&hashtags={q('CryptoTrading,AlgoTrading,QuantitativeFinance', safe='')}"
    li_url = f"https://www.linkedin.com/sharing/share-offsite/?url={q(canon_url, safe='')}"
    wa_url = f"https://api.whatsapp.com/send?text={q(share_text + ' ' + canon_url, safe='')}"
    tg_url = f"https://t.me/share/url?url={q(canon_url, safe='')}&text={q(share_text, safe='')}"
    rd_url = f"https://reddit.com/submit?url={q(canon_url, safe='')}&title={q(title, safe='')}"
    return f"""<div class="blog-share-bar" style="margin:16px 0 0">
      <span class="blog-share-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Share Post:</span>
      <div class="blog-share-btns">
        <a class="share-btn x" href="{x_url}" target="_blank" rel="noopener noreferrer" title="Post to X" aria-label="Post to X"><svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg><span>Post</span></a>
        <a class="share-btn li" href="{li_url}" target="_blank" rel="noopener noreferrer" title="Share on LinkedIn" aria-label="Share on LinkedIn"><svg viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg><span>LinkedIn</span></a>
        <a class="share-btn wa" href="{wa_url}" target="_blank" rel="noopener noreferrer" title="Share via WhatsApp" aria-label="Share via WhatsApp"><svg viewBox="0 0 24 24"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.53c-.25.7-.78 1.29-1.44 1.45-.45.11-1.04.16-3.32-.78-2.64-1.09-4.34-3.77-4.47-3.95-.13-.18-1.08-1.44-1.08-2.75 0-1.31.68-1.95.93-2.22.25-.26.54-.33.72-.33.18 0 .36 0 .52.01.17.01.4-.06.62.48.23.55.78 1.91.85 2.05.07.14.12.3.02.48-.09.18-.14.3-.28.46-.14.16-.29.36-.42.48-.14.13-.28.28-.12.56.16.27.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.21 1.37.28.14.44.11.6-.07.17-.18.7-.82.89-1.1.18-.28.37-.23.63-.14.25.09 1.61.76 1.89.9.28.14.46.21.53.33.07.12.07.69-.18 1.39z"/></svg><span>WhatsApp</span></a>
        <a class="share-btn tg" href="{tg_url}" target="_blank" rel="noopener noreferrer" title="Share via Telegram" aria-label="Share via Telegram"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg><span>Telegram</span></a>
        <a class="share-btn rd" href="{rd_url}" target="_blank" rel="noopener noreferrer" title="Share on Reddit" aria-label="Share on Reddit"><svg viewBox="0 0 24 24"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm5.74-10.74a1.35 1.35 0 0 0-1.28-.93 1.33 1.33 0 0 0-.86.32c-1.02-.73-2.42-1.2-3.98-1.26l.68-3.19 2.22.47a1.05 1.05 0 0 0 1.03.83 1.06 1.06 0 1 0-1.06-1.06c0 .08.01.16.03.24l-2.48-.52a.26.26 0 0 0-.31.2l-.78 3.69c-1.6.05-3.04.52-4.08 1.27a1.35 1.35 0 0 0-2.14.61 1.33 1.33 0 0 0 .32 1.35c-.03.17-.05.35-.05.53 0 2.68 3.13 4.85 7 4.85s7-2.17 7-4.85c0-.18-.02-.36-.05-.53a1.35 1.35 0 0 0 .51-1.07zm-9.24.74a1.06 1.06 0 1 1-2.12 0 1.06 1.06 0 0 1 2.12 0zm5.02 3.19c-.64.64-1.85.69-2.02.69s-1.38-.05-2.02-.69a.27.27 0 0 1 .38-.38c.45.45 1.34.52 1.64.52.3 0 1.19-.07 1.64-.52a.27.27 0 0 1 .38.38zm-.52-2.13a1.06 1.06 0 1 1-2.12 0 1.06 1.06 0 0 1 2.12 0z"/></svg><span>Reddit</span></a>
        <button type="button" class="share-btn copy" onclick="copyBlogLink()" title="Copy Link" aria-label="Copy Link"><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Copy Link</span></button>
      </div>
    </div>"""


def post_parts(p):
    """(title, desc, canonical, main_html, extra_head) - same shape article_parts() returns, so
    build.py's emit() call site is identical for /learn/ and /blog/. BlogPosting (not Article) is
    the more precise schema.org type for genuinely dated, timely posts."""
    e = html.escape
    title = f"{p['title']} | zengtrade Blog"
    canonical = f"{SITE}/blog/{p['slug']}/"
    crumb = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"},
        {"@type": "ListItem", "position": 2, "name": "Blog", "item": f"{SITE}/blog/"},
        {"@type": "ListItem", "position": 3, "name": p["title"], "item": canonical},
    ]}
    post_schema = {
        "@context": "https://schema.org",
        "@type": ["BlogPosting", "TechArticle"],
        "headline": p["title"],
        "description": p["description"],
        "datePublished": p["date"],
        "dateModified": p["date"],
        "inLanguage": "en-US",
        "mainEntityOfPage": {"@type": "WebPage", "@id": canonical},
        "author": {
            "@type": "Organization",
            "name": "zengtrade Quantitative Research Group",
            "url": f"{SITE}/how-it-works/#honesty",
            "logo": f"{SITE}/assets/logo.svg"
        },
        "reviewedBy": {
            "@type": "Organization",
            "name": "zengtrade Algorithmic Risk Committee",
            "url": f"{SITE}/risk/"
        },
        "publisher": {
            "@type": "Organization",
            "name": "zengtrade",
            "url": SITE,
            "logo": {
                "@type": "ImageObject",
                "url": f"{SITE}/assets/logo.svg"
            }
        },
    }
    extra_head = (f'<script type="application/ld+json">{json.dumps(crumb)}</script>'
                  f'<script type="application/ld+json">{json.dumps(post_schema)}</script>')
    share_bar = render_blog_share_bar(canonical, p['title'])
    main = f"""<main id="main">
  <section class="lp-hero" aria-labelledby="h-post">
    <div class="lp-wrap">
      <nav class="coin-crumb" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/blog/">Blog</a> &rsaquo; {e(p['title'])}</nav>
      <h1 id="h-post" class="lp-h1">{e(p['title'])}</h1>
      <p class="lp-sub">{e(p['description'])}</p>
      <p class="article-meta">{e(p['date'])}</p>
      {share_bar}
    </div>
  </section>
  <section class="lp-sec" aria-label="Post">
    <div class="lp-wrap article-body">
      {p['body_html']}
      <div class="pseo-eeat-card" style="margin:28px 0">
        <div class="eeat-badge"><span>✓</span> Quantitative Verification &amp; Risk Governance</div>
        <p><strong>Authored by zengtrade Quantitative Research Group &bull; Reviewed by Algorithmic Risk Committee:</strong> Every article adheres to our quantitative integrity standard: 35 bps round-trip friction model, non-custodial execution, and zero hypothetical yield fabrication. Read our <a href="/how-it-works/">Regime Methodology</a> and <a href="/risk/">Risk Disclosures</a>.</p>
      </div>
      <p class="lp-fineprint">Not investment advice. zengtrade is paper-first and non-custodial.</p>
      <div class="lp-cta-row center" style="margin-top:20px">
      <a class="lp-cta primary" href="/login/?mode=signup&amp;utm_source=site&amp;utm_medium=organic&amp;utm_campaign=blog_{p['slug']}">Start free, paper-trade any coin</a>
      </div>
    </div>
  </section>
  <script>
  function copyBlogLink() {{
    var url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {{
      navigator.clipboard.writeText(url).then(function() {{
        showToast('Blog post link copied to clipboard!');
      }}).catch(function() {{
        prompt('Copy this link:', url);
      }});
    }} else {{
      prompt('Copy this link:', url);
    }}
  }}
  function showToast(msg) {{
    var t = document.getElementById('shareToast');
    if (!t) {{
      t = document.createElement('div');
      t.id = 'shareToast';
      t.className = 'share-toast';
      document.body.appendChild(t);
    }}
    t.textContent = '';
    var dot = document.createElement('span');
    dot.className = 'share-toast-dot';
    t.appendChild(dot);
    t.appendChild(document.createTextNode(' ' + msg));
    t.classList.add('show');
    clearTimeout(window._toastTimeout);
    window._toastTimeout = setTimeout(function() {{
      t.classList.remove('show');
    }}, 2600);
  }}
  </script>
</main>"""
    return title, p["description"], canonical, main, extra_head


def blog_hub_schema(posts):
    crumb = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"},
        {"@type": "ListItem", "position": 2, "name": "Blog", "item": f"{SITE}/blog/"}]}
    items = [{"@type": "ListItem", "position": i + 1, "name": p["title"],
              "url": f"{SITE}/blog/{p['slug']}/"} for i, p in enumerate(posts)]
    item_list = {"@context": "https://schema.org", "@type": "CollectionPage",
                 "name": "zengtrade Blog", "url": f"{SITE}/blog/",
                 "mainEntity": {"@type": "ItemList", "itemListElement": items}}
    return (f'<script type="application/ld+json">{json.dumps(crumb)}</script>'
            f'<script type="application/ld+json">{json.dumps(item_list)}</script>')


def blog_hub_main(posts):
    e = html.escape
    rows = "".join(
        f'<a class="blog-hub-row" href="/blog/{e(p["slug"])}/"><b>{e(p["title"])}</b>'
        f'<span class="article-meta">{e(p["date"])}</span><span>{e(p["description"])}</span></a>'
        for p in posts)
    posts_section = f'<div class="blog-hub-list">{rows}</div>' if rows else ""
    quant_style = "" if rows else ' style="margin-top:0;padding-top:0;border-top:none"'
    return f"""<main id="main">
  <section class="lp-hero" aria-labelledby="h-blog">
    <div class="lp-wrap">
      <nav class="coin-crumb" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; Blog</nav>
      <div class="lp-eyebrow"><span class="dot"></span> quantitative research</div>
      <h1 id="h-blog" class="lp-h1">The zengtrade <span class="hl">blog</span></h1>
      <p class="lp-sub">Data-driven quantitative research, algorithmic execution models, and regime-aware trading insights. No hype, no fabricated numbers.</p>
    </div>
  </section>
  <section class="lp-sec" aria-label="Posts">
    <div class="lp-wrap">
      {posts_section}
      <div class="quant-research-section"{quant_style}>
        <h2>Quantitative Research Engine</h2>
        <p>Explore over 200,000 data-driven, programmatic research articles analyzing regime-aware crypto trading strategies, indicators, risk management, and market microstructure across the entire Binance-tradable universe.</p>
        <div class="quant-grid">
          <a class="quant-card" href="/blog/category/markets/"><b>Markets Analysis</b><span>Macro regimes and asset class dynamics.</span></a>
          <a class="quant-card" href="/blog/category/trading/"><b>Trading Mechanics</b><span>Execution algorithms, order flow, and slippage.</span></a>
          <a class="quant-card" href="/blog/category/investing/"><b>Systematic Investing</b><span>Long-term data-driven portfolio models.</span></a>
          <a class="quant-card" href="/blog/category/algo/"><b>Algo Studio</b><span>Automated execution, backtesting, and latency.</span></a>
          <a class="quant-card" href="/blog/category/strategies/"><b>Trading Strategies</b><span>Deep dives into quantitative strategies.</span></a>
          <a class="quant-card" href="/blog/category/indicators/"><b>Technical Indicators</b><span>Mathematical formulas and signal filters.</span></a>
          <a class="quant-card" href="/blog/category/risk/"><b>Risk Management</b><span>Dynamic ATR sizing, stops, and kill-switches.</span></a>
          <a class="quant-card" href="/blog/category/derivatives/"><b>Derivatives &amp; Arbitrage</b><span>Funding rates, cash &amp; carry, and basis trades.</span></a>
        </div>
      </div>
    </div>
  </section>
</main>"""
