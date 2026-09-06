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
import html, json, os

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
        "@context": "https://schema.org", "@type": "Article",
        "headline": a["title"], "description": a["description"],
        "datePublished": a["date"],
        "author": {"@type": "Organization", "name": "zengtrade"},
        "publisher": {"@type": "Organization", "name": "zengtrade", "url": SITE},
    }
    extra_head = (f'<script type="application/ld+json">{json.dumps(crumb)}</script>'
                  f'<script type="application/ld+json">{json.dumps(article_schema)}</script>')
    main = f"""<main id="main">
  <section class="lp-hero" aria-labelledby="h-article">
    <div class="lp-wrap">
      <nav class="coin-crumb" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/learn/">Learn</a> &rsaquo; {e(a['title'])}</nav>
      <h1 id="h-article" class="lp-h1">{e(a['title'])}</h1>
      <p class="lp-sub">{e(a['description'])}</p>
      <p class="article-meta">Updated {e(a['date'])}</p>
    </div>
  </section>
  <section class="lp-sec" aria-label="Article">
    <div class="lp-wrap article-body">
      {a['body_html']}
      <p class="lp-fineprint">Educational content, not investment advice. zengtrade is paper-first and non-custodial.</p>
      <div class="lp-cta-row center" style="margin-top:20px">
      <a class="lp-cta primary" href="/login?mode=signup&amp;utm_source=site&amp;utm_medium=organic&amp;utm_campaign=learn_{a['slug']}">Start free — paper-trade any coin</a>
      <a class="lp-cta ghost" href="/login?mode=signup&amp;plan=pro&amp;utm_source=site&amp;utm_medium=organic&amp;utm_campaign=learn_{a['slug']}_pro">Founding Pro $19/mo</a>
      </div>
    </div>
  </section>
</main>"""
    return title, a["description"], canonical, main, extra_head


def _truncate(text, limit=90):
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return cut + "…"


def articles_hub_main(articles):
    e = html.escape
    cards = "".join(
        f'<a class="home-card" href="/learn/{e(a["slug"])}/"><b>{e(a["title"])}</b>'
        f'<span>{e(_truncate(a["description"]))}</span></a>' for a in articles)
    return f"""<main id="main">
  <section class="lp-hero" aria-labelledby="h-learn">
    <div class="lp-wrap">
      <div class="lp-eyebrow"><span class="dot"></span> guides &amp; explainers</div>
      <h1 id="h-learn" class="lp-h1">Learn <span class="hl">how zengtrade works</span></h1>
      <p class="lp-sub">Plain-English explainers on regimes, costs, and paper-first evidence. No hype, no live-trading promises.</p>
    </div>
  </section>
  <section class="lp-sec" aria-label="Articles">
    <div class="lp-wrap"><div class="lp-grid4">{cards}</div></div>
  </section>
</main>"""
