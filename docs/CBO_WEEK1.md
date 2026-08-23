# CBO — Week 1 organic playbook (post-P0 ship)

Run after `./scripts/founder-preflight.sh` shows production + worker green.

## Day 1 — Search Console

1. [Google Search Console](https://search.google.com/search-console) → add `https://zengtrade.in`
2. Verify via DNS TXT (recommended) or HTML tag in `deploy/landing/build.py` if needed
3. Submit sitemap: **https://zengtrade.in/sitemap.xml**
4. Request indexing for:
   - https://zengtrade.in/
   - https://zengtrade.in/pricing/
   - https://zengtrade.in/login
   - https://zengtrade.in/coins/bitcoin/

See `docs/GSC_SETUP.md` for detail.

## Day 2–3 — Proof content

Use `docs/content/WEEKLY_PROOF.md` templates **only after** real forward paper trades exist.

Channels (pick 2):
- X/Twitter thread with Forward Test screenshot
- r/algotrading value post (link in comments if required)
- LinkedIn founder note

UTM pattern: `?utm_source=x&utm_medium=organic&utm_campaign=week1`

## Day 4–5 — Founding Pro push

1. Confirm `/app#pricing` shows **$19/mo founding**
2. Test checkout with small payment → verify `profile.tier = pro` in `/admin`
3. Add “Founding 100” scarcity copy if counter < 100 (manual for now)

Track in `/admin`:
- `plan_intents_7d`
- `checkout_clicks_7d`
- `paying` / MRR tile

## Weekly review (every Monday)

| Metric | Source |
|--------|--------|
| Organic sessions | GSC Performance |
| Signup views | `/admin` tile |
| Signups complete | `/admin` tile |
| Deploy success | `/admin` tile |
| MRR | `/admin` tile |

Log deltas in `docs/GROWTH_DASHBOARD.md`.
