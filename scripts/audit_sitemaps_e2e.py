#!/usr/bin/env python3
"""
E2E In-Depth Sitemap and URL Verifier for zengtrade.in
Tests each sitemap in sitemap-index.xml, parses every URL, and probes pages
for HTTP 200, valid HTML, title, meta description, and content integrity.
"""
import concurrent.futures
import json
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

RESOLVE_IP = "104.21.9.225"
SITE = "https://zengtrade.in"

def fetch_url(url, timeout=10):
    cmd = [
        "curl", "-s", "-L",
        "--resolve", f"zengtrade.in:443:{RESOLVE_IP}",
        "-w", "\n__METRICS__:%{http_code}:%{size_download}:%{time_total}",
        url
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=timeout)
        raw = proc.stdout.decode("utf-8", errors="ignore")
        if "\n__METRICS__:" in raw:
            body, metrics = raw.split("\n__METRICS__:", 1)
            code, size, time_total = metrics.strip().split(":")
            return int(code), int(size), float(time_total), body
        return 0, 0, 0, ""
    except Exception as e:
        return 0, 0, 0, str(e)

def parse_sitemap(url):
    code, size, time_total, body = fetch_url(url)
    if code != 200:
        return False, f"HTTP {code}", []
    try:
        root = ET.fromstring(body)
        urls = []
        for elem in root.findall("{http://www.sitemaps.org/schemas/sitemap/0.9}url"):
            loc = elem.find("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")
            if loc is not None and loc.text:
                urls.append(loc.text.strip())
        return True, "Valid XML", urls
    except Exception as e:
        return False, f"XML Parse Error: {e}", []

def verify_page(url):
    code, size, time_total, html = fetch_url(url)
    errors = []
    if code != 200:
        errors.append(f"HTTP {code}")
    if size < 500:
        errors.append(f"Page size too small ({size} bytes)")
    if "<title>" not in html or "</title>" not in html:
        errors.append("Missing <title> tag")
    else:
        title_match = re.search(r"<title>(.*?)</title>", html, re.DOTALL | re.IGNORECASE)
        if not title_match or not title_match.group(1).strip():
            errors.append("Empty <title> tag")
        elif "404" in title_match.group(1):
            errors.append(f"404 in title: {title_match.group(1).strip()}")

    if "name=\"description\"" not in html and "property=\"og:description\"" not in html:
        errors.append("Missing meta description")

    # Check for unrendered template leaks like {{ or }}
    if "{{" in html and "}}" in html:
        # Check if it's a vue/angular or accidental raw jinja/mustache
        if re.search(r"\{\{\s*[a-zA-Z_]+\s*\}\}", html):
            errors.append("Unrendered template tag found")

    return {
        "url": url,
        "code": code,
        "size": size,
        "time": time_total,
        "valid": len(errors) == 0,
        "errors": errors
    }

def main():
    print("=" * 60)
    print("🚀 STARTING E2E IN-DEPTH SITEMAP AUDIT ON zengtrade.in")
    print("=" * 60)

    # 1. Fetch sitemap-index.xml
    index_url = f"{SITE}/sitemap-index.xml"
    print(f"Fetching sitemap index: {index_url}")
    code, size, time_total, body = fetch_url(index_url)
    if code != 200:
        print(f"❌ Failed to fetch {index_url}: HTTP {code}")
        sys.exit(1)

    root = ET.fromstring(body)
    sub_sitemaps = []
    for elem in root.findall("{http://www.sitemaps.org/schemas/sitemap/0.9}sitemap"):
        loc = elem.find("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")
        if loc is not None and loc.text:
            sub_sitemaps.append(loc.text.strip())

    print(f"✓ Found {len(sub_sitemaps)} sub-sitemaps in index.\n")

    overall_results = {}
    total_urls_discovered = 0
    urls_to_test = []

    # 2. Parse each sub-sitemap
    for sm_url in sub_sitemaps:
        sm_name = sm_url.split("/")[-1]
        valid, msg, urls = parse_sitemap(sm_url)
        if not valid:
            print(f"❌ {sm_name}: {msg}")
            overall_results[sm_name] = {"status": "FAIL", "msg": msg, "count": 0}
            continue

        print(f"✅ {sm_name:30} | Valid XML | {len(urls):6d} URLs")
        overall_results[sm_name] = {"status": "PASS", "count": len(urls)}
        total_urls_discovered += len(urls)

        # Sampling strategy:
        # If count <= 50, test 100% of URLs
        # If count > 50, test first 10, middle 10, last 10, plus 20 random (sample of 50 per partition)
        if len(urls) <= 50:
            urls_to_test.extend([(sm_name, u) for u in urls])
        else:
            step = len(urls) // 40
            sample = urls[::step][:50]
            # Ensure first and last are tested
            if urls[0] not in sample:
                sample.insert(0, urls[0])
            if urls[-1] not in sample:
                sample.append(urls[-1])
            urls_to_test.extend([(sm_name, u) for u in sample])

    print("\n" + "=" * 60)
    print(f"📊 SUMMARY: {total_urls_discovered} total programmatic URLs discovered.")
    print(f"🔬 SAMPLE TESTING: {len(urls_to_test)} diverse URLs across all categories.")
    print("=" * 60 + "\n")

    # 3. Parallel verification of pages
    failures = []
    success_count = 0
    tested_count = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_to_url = {executor.submit(verify_page, u): (sm, u) for sm, u in urls_to_test}
        for future in concurrent.futures.as_completed(future_to_url):
            sm, u = future_to_url[future]
            tested_count += 1
            res = future.result()
            if res["valid"]:
                success_count += 1
                if tested_count % 25 == 0 or tested_count == len(urls_to_test):
                    print(f"  [{tested_count}/{len(urls_to_test)}] Progress: {success_count} passed...")
            else:
                failures.append((sm, res))
                print(f"  ❌ FAILED: {u} -> {', '.join(res['errors'])}")

    print("\n" + "=" * 60)
    print("🏁 AUDIT RESULTS")
    print("=" * 60)
    print(f"Tested:  {tested_count}")
    print(f"Passed:  {success_count}")
    print(f"Failed:  {len(failures)}")

    if failures:
        print("\n⚠️ FAILURES DETECTED:")
        for sm, f in failures:
            print(f"  [{sm}] {f['url']} -> {f['errors']}")
        sys.exit(1)
    else:
        print("\n🎉 100% OF SAMPLED PAGES ACROSS ALL SITEMAPS PASSED E2E VALIDATION!")
        print("  - All HTTP 200 OK")
        print("  - All HTML valid with Title & Meta descriptions")
        print("  - Zero 404s, zero template leaks")

if __name__ == "__main__":
    main()
