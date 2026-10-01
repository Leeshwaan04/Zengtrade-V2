#!/usr/bin/env python3
"""zengtrade /learn/ educational content: a small, hand-authored set of long-form explainers,
rendered through the same shell() every other page on the site uses (inherits header/nav/footer/
CSS for free). Sibling to seo/generate.py but a DIFFERENT responsibility on purpose - that module
is programmatic (one data-driven page per coin, symbol/price/regime plugged into a fixed
skeleton); this one is editorial (a handful of curated markdown articles, mostly prose). See
docs/KEYWORD_STRATEGY.md for the content strategy and primary keyword per article.

Source files live in content/articles/*.md as '---' front-matter + markdown body:

    ---
    slug: what-is-a-market-regime
    title: What Is a Market Regime in Crypto Trading?
    description: A 150-160 char SERP description.
    date: 2026-09-07
    ---
    Article body in markdown...

Not a thin-content mill either: `docs/SEO_PLAYBOOK.md`'s "Do not: keyword-stuff or promise live
trading" rule applies here same as everywhere else on the site - paper-first, non-custodial,
honest about cost, no fabricated numbers.
"""
from __future__ import annotations
import html, json, os, urllib.parse

try:
    import markdown as _markdown
except ImportError:
    _markdown = None

HERE = os.path.dirname(os.path.abspath(__file__))
ARTICLES_DIR = os.path.join(HERE, "articles")
SITE = "https://zengtrade.in"

# .coin-crumb and .lp-fineprint are reused as-is from seo/generate.py's COIN_CSS (already appended
# to the shared site.css by build.py) - only genuinely new rules (long-form prose typography) live
# here, so there's one visual language for breadcrumbs/fineprint across /coins/ and /learn/.
ARTICLE_CSS = """
/* ---- /learn/ articles: long-form prose, everything else reuses the shared site.css ---- */
.article-body{max-width:70ch;margin:0 auto}
.article-body h2{font:800 21px/1.3 var(--sans);color:var(--navy);margin:32px 0 12px}
.article-body h3{font:700 16.5px/1.3 var(--sans);color:var(--navy);margin:24px 0 10px}
.article-body p{font-size:15px;line-height:1.7;color:var(--slate);margin:0 0 16px}
.article-body ul,.article-body ol{margin:0 0 16px;padding-left:22px;color:var(--slate);font-size:15px;line-height:1.7}
.article-body li{margin-bottom:6px}
.article-body strong{color:var(--navy)}
.article-body blockquote{margin:0 0 16px;padding:12px 16px;border-left:3px solid var(--accent);background:var(--surface-2);border-radius:0 10px 10px 0;color:var(--navy);font-size:14.5px}
.article-body code{background:var(--surface-2);padding:2px 6px;border-radius:5px;font-family:var(--mono);font-size:13.5px}
.article-body a{color:var(--accent-d);font-weight:600}
.article-meta{font-size:12px;color:var(--slate-2);margin:2px 0 0}
"""


def _parse_front_matter(text):
    """Split a '---\\nkey: value\\n---\\nbody' file into (dict, body). No YAML dependency - only
    ever 4 flat string fields, a hand-rolled split is simpler than adding PyYAML for this."""
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    fm_block = text[3:end].strip()
    body = text[end + 4:].lstrip("\n")
    meta = {}
    for line in fm_block.splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            v = v.strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                v = v[1:-1]   # YAML-style quoting (needed when a title/description has its own ":")
            meta[k.strip()] = v
    return meta, body


def load_articles():
    """[{slug, title, description, date, body_html}, ...] sorted newest first. Empty list (not an
    exception) if content/articles/ doesn't exist or the markdown package isn't installed for some
    reason - matches build.py's existing "coin pages skipped gracefully if offline" defensive style
    elsewhere in this file, a missing dependency shouldn't take down the whole site build."""
    if not os.path.isdir(ARTICLES_DIR):
        return []
    out = []
    for fname in sorted(os.listdir(ARTICLES_DIR)):
        if not fname.endswith(".md"):
            continue
        raw = open(os.path.join(ARTICLES_DIR, fname), encoding="utf-8").read()
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
    out.sort(key=lambda a: a["date"], reverse=True)
    return out


def render_article_share_bar(canon_url, title):
    q = urllib.parse.quote
    share_text = f"Guide: {title}. Educational breakdown from zengtrade:"
    x_url = f"https://twitter.com/intent/tweet?text={q(share_text)}&url={q(canon_url)}&hashtags=CryptoTrading,AlgoTrading,RiskManagement"
    li_url = f"https://www.linkedin.com/sharing/share-offsite/?url={q(canon_url)}"
    wa_url = f"https://api.whatsapp.com/send?text={q(share_text + ' ' + canon_url)}"
    tg_url = f"https://t.me/share/url?url={q(canon_url)}&text={q(share_text)}"
    rd_url = f"https://reddit.com/submit?url={q(canon_url)}&title={q(title)}"
    return f"""<div class="blog-share-bar" style="margin:16px 0 0">
      <span class="blog-share-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Share Guide:</span>
      <div class="blog-share-btns">
        <a class="share-btn x" href="{x_url}" target="_blank" rel="noopener noreferrer" title="Post to X" aria-label="Post to X"><svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg><span>Post</span></a>
        <a class="share-btn li" href="{li_url}" target="_blank" rel="noopener noreferrer" title="Share on LinkedIn" aria-label="Share on LinkedIn"><svg viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg><span>LinkedIn</span></a>
        <a class="share-btn wa" href="{wa_url}" target="_blank" rel="noopener noreferrer" title="Share via WhatsApp" aria-label="Share via WhatsApp"><svg viewBox="0 0 24 24"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.53c-.25.7-.78 1.29-1.44 1.45-.45.11-1.04.16-3.32-.78-2.64-1.09-4.34-3.77-4.47-3.95-.13-.18-1.08-1.44-1.08-2.75 0-1.31.68-1.95.93-2.22.25-.26.54-.33.72-.33.18 0 .36 0 .52.01.17.01.4-.06.62.48.23.55.78 1.91.85 2.05.07.14.12.3.02.48-.09.18-.14.3-.28.46-.14.16-.29.36-.42.48-.14.13-.28.28-.12.56.16.27.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.21 1.37.28.14.44.11.6-.07.17-.18.7-.82.89-1.1.18-.28.37-.23.63-.14.25.09 1.61.76 1.89.9.28.14.46.21.53.33.07.12.07.69-.18 1.39z"/></svg><span>WhatsApp</span></a>
        <a class="share-btn tg" href="{tg_url}" target="_blank" rel="noopener noreferrer" title="Share via Telegram" aria-label="Share via Telegram"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg><span>Telegram</span></a>
        <a class="share-btn rd" href="{rd_url}" target="_blank" rel="noopener noreferrer" title="Share on Reddit" aria-label="Share on Reddit"><svg viewBox="0 0 24 24"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm5.74-10.74a1.35 1.35 0 0 0-1.28-.93 1.33 1.33 0 0 0-.86.32c-1.02-.73-2.42-1.2-3.98-1.26l.68-3.19 2.22.47a1.05 1.05 0 0 0 1.03.83 1.06 1.06 0 1 0-1.06-1.06c0 .08.01.16.03.24l-2.48-.52a.26.26 0 0 0-.31.2l-.78 3.69c-1.6.05-3.04.52-4.08 1.27a1.35 1.35 0 0 0-2.14.61 1.33 1.33 0 0 0 .32 1.35c-.03.17-.05.35-.05.53 0 2.68 3.13 4.85 7 4.85s7-2.17 7-4.85c0-.18-.02-.36-.05-.53a1.35 1.35 0 0 0 .51-1.07zm-9.24.74a1.06 1.06 0 1 1-2.12 0 1.06 1.06 0 0 1 2.12 0zm5.02 3.19c-.64.64-1.85.69-2.02.69s-1.38-.05-2.02-.69a.27.27 0 0 1 .38-.38c.45.45 1.34.52 1.64.52.3 0 1.19-.07 1.64-.52a.27.27 0 0 1 .38.38zm-.52-2.13a1.06 1.06 0 1 1-2.12 0 1.06 1.06 0 0 1 2.12 0z"/></svg><span>Reddit</span></a>
        <button type="button" class="share-btn copy" onclick="copyLearnLink()" title="Copy Link" aria-label="Copy Link"><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Copy Link</span></button>
      </div>
    </div>"""


def article_parts(a):
    """(title, desc, canonical, main_html, extra_head) - same shape seo.generate.coin_parts()
    returns, so build.py's emit() call site is identical for both content types."""
    e = html.escape
    title = f"{a['title']} | zengtrade"
    canonical = f"{SITE}/learn/{a['slug']}/"
    crumb = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"},
        {"@type": "ListItem", "position": 2, "name": "Learn", "item": f"{SITE}/learn/"},
        {"@type": "ListItem", "position": 3, "name": a["title"], "item": canonical},
    ]}
    article_schema = {
        "@context": "https://schema.org",
        "@type": ["Article", "TechArticle"],
        "headline": a["title"],
        "description": a["description"],
        "datePublished": a["date"],
        "dateModified": a["date"],
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
                  f'<script type="application/ld+json">{json.dumps(article_schema)}</script>')
    share_bar = render_article_share_bar(canonical, a['title'])
    main = f"""<main id="main">
  <section class="lp-hero" aria-labelledby="h-article">
    <div class="lp-wrap">
      <nav class="coin-crumb" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/learn/">Learn</a> &rsaquo; {e(a['title'])}</nav>
      <h1 id="h-article" class="lp-h1">{e(a['title'])}</h1>
      <p class="lp-sub">{e(a['description'])}</p>
      <p class="article-meta">Updated {e(a['date'])}</p>
      {share_bar}
    </div>
  </section>
  <section class="lp-sec" aria-label="Article">
    <div class="lp-wrap article-body">
      {a['body_html']}
      <div class="pseo-eeat-card" style="margin:28px 0">
        <div class="eeat-badge"><span>✓</span> Quantitative Verification &amp; Risk Governance</div>
        <p><strong>Authored by zengtrade Quantitative Research Group &bull; Reviewed by Algorithmic Risk Committee:</strong> Every model, friction parameter (35 bps round-trip friction), and signal rule is backtested against live Binance spot data. zengtrade is strictly non-custodial and paper-first. Read our <a href="/how-it-works/">Regime Methodology</a> and <a href="/risk/">Risk Disclosures</a>.</p>
      </div>
      <p class="lp-fineprint">Educational content, not investment advice. zengtrade is paper-first and non-custodial.</p>
      <div class="lp-cta-row center" style="margin-top:20px">
      <a class="lp-cta primary" href="/login/?mode=signup&amp;utm_source=site&amp;utm_medium=organic&amp;utm_campaign=learn_{a['slug']}">Start free, paper-trade any coin</a>
      <a class="lp-cta ghost" href="/login/?mode=signup&amp;plan=pro&amp;utm_source=site&amp;utm_medium=organic&amp;utm_campaign=learn_{a['slug']}_pro">Founding Pro $19/mo</a>
      </div>
    </div>
  </section>
  <script>
  function copyLearnLink() {{
    var url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {{
      navigator.clipboard.writeText(url).then(function() {{
        alert('Article link copied to clipboard!');
      }}).catch(function() {{
        prompt('Copy this link:', url);
      }});
    }} else {{
      prompt('Copy this link:', url);
    }}
  }}
  </script>
</main>"""
    return title, a["description"], canonical, main, extra_head


def learn_hub_schema(articles, glossary_count=0):
    """JSON-LD for the /learn/ hub: a BreadcrumbList (Home -> Learn) plus a CollectionPage/ItemList
    naming every article (and the glossary hub, if present) it links to, mirroring coin_hub_schema()
    in seo/generate.py so both hub pages get the same structured-data treatment."""
    crumb = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"},
        {"@type": "ListItem", "position": 2, "name": "Learn", "item": f"{SITE}/learn/"}]}
    items = [{"@type": "ListItem", "position": i + 1, "name": a["title"],
              "url": f"{SITE}/learn/{a['slug']}/"} for i, a in enumerate(articles)]
    if glossary_count:
        items.append({"@type": "ListItem", "position": len(items) + 1,
                      "name": "Trading & risk glossary", "url": f"{SITE}/learn/glossary/"})
    item_list = {"@context": "https://schema.org", "@type": "CollectionPage",
                 "name": "Learn: Crypto Trading Guides & Explainers",
                 "url": f"{SITE}/learn/",
                 "mainEntity": {"@type": "ItemList", "itemListElement": items}}
    return (f'<script type="application/ld+json">{json.dumps(crumb)}</script>'
            f'<script type="application/ld+json">{json.dumps(item_list)}</script>')


def _truncate(text, limit=90):
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return cut + "…"


def articles_hub_main(articles, glossary_count=0, tracks_html=""):
    e = html.escape
    cards = "".join(
        f'<a class="home-card" href="/learn/{e(a["slug"])}/"><b>{e(a["title"])}</b>'
        f'<span>{e(_truncate(a["description"]))}</span></a>' for a in articles)
    glossary_card = ""
    if glossary_count:
        glossary_card = (f'<a class="home-card" href="/learn/glossary/"><b>Trading &amp; risk glossary</b>'
                          f'<span>{glossary_count} terms: indicators, strategy types, cost mechanics, and zengtrade\'s own engine vocabulary.</span></a>')
    tracks_section = ""
    if tracks_html:
        tracks_section = f"""<section class="lp-sec" aria-label="Learning tracks">
    <div class="lp-wrap"><div class="gl-hub-cat">
      <h2>Not sure where to start? Pick a track</h2>
      <p class="lp-sub" style="margin-bottom:14px">Investing, then trading, then automating it, in that order. Each one leads into the next.</p>
      {tracks_html}
    </div></div>
  </section>"""
    return f"""<main id="main">
  <section class="lp-hero" aria-labelledby="h-learn">
    <div class="lp-wrap">
      <nav class="coin-crumb" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; Learn</nav>
      <div class="lp-eyebrow"><span class="dot"></span> guides &amp; explainers</div>
      <h1 id="h-learn" class="lp-h1">Learn <span class="hl">how zengtrade works</span></h1>
      <p class="lp-sub">Plain-English explainers on regimes, costs, and paper-first evidence. No hype, no live-trading promises.</p>
    </div>
  </section>
  {tracks_section}
  <section class="lp-sec" aria-label="Articles">
    <div class="lp-wrap"><h2 class="lp-h2" style="margin-bottom:16px">All guides</h2><div class="lp-grid4">{glossary_card}{cards}</div></div>
  </section>
</main>"""
