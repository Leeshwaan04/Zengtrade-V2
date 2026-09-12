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
import html, json, os

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
        "@context": "https://schema.org", "@type": "BlogPosting",
        "headline": p["title"], "description": p["description"],
        "datePublished": p["date"],
        "author": {"@type": "Organization", "name": "zengtrade"},
        "publisher": {"@type": "Organization", "name": "zengtrade", "url": SITE},
    }
    extra_head = (f'<script type="application/ld+json">{json.dumps(crumb)}</script>'
                  f'<script type="application/ld+json">{json.dumps(post_schema)}</script>')
    main = f"""<main id="main">
  <section class="lp-hero" aria-labelledby="h-post">
    <div class="lp-wrap">
      <nav class="coin-crumb" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/blog/">Blog</a> &rsaquo; {e(p['title'])}</nav>
      <h1 id="h-post" class="lp-h1">{e(p['title'])}</h1>
      <p class="lp-sub">{e(p['description'])}</p>
      <p class="article-meta">{e(p['date'])}</p>
    </div>
  </section>
  <section class="lp-sec" aria-label="Post">
    <div class="lp-wrap article-body">
      {p['body_html']}
      <p class="lp-fineprint">Not investment advice. zengtrade is paper-first and non-custodial.</p>
      <div class="lp-cta-row center" style="margin-top:20px">
      <a class="lp-cta primary" href="/login/?mode=signup&amp;utm_source=site&amp;utm_medium=organic&amp;utm_campaign=blog_{p['slug']}">Start free, paper-trade any coin</a>
      </div>
    </div>
  </section>
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
    empty = '<p class="lp-sub">First post coming soon.</p>' if not posts else ""
    return f"""<main id="main">
  <section class="lp-hero" aria-labelledby="h-blog">
    <div class="lp-wrap">
      <nav class="coin-crumb" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; Blog</nav>
      <div class="lp-eyebrow"><span class="dot"></span> building in public</div>
      <h1 id="h-blog" class="lp-h1">The zengtrade <span class="hl">blog</span></h1>
      <p class="lp-sub">What actually shipped, what it changes, and honest progress notes. No hype, no fabricated numbers.</p>
    </div>
  </section>
  <section class="lp-sec" aria-label="Posts">
    <div class="lp-wrap">{empty}<div class="blog-hub-list">{rows}</div></div>
  </section>
</main>"""
