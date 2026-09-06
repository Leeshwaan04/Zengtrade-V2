# zengtrade: going live on Hostinger (no Cloudflare)

The public SaaS site (`saas/web/`) is plain static + hash-routed, so it drops straight onto
Hostinger. The private trading terminal stays **local on your Mac** (localhost:8011): it is
NOT published anywhere. Supabase (auth + DB) and the deployed webhook are already cloud-hosted.

## What serves what

| Host | What |
|---|---|
| **Hostinger** `zengtrade.in` | public SaaS site (signup, pricing, dashboard) |
| **your Mac** `localhost:8011` | your private terminal (unchanged, not public) |
| **Supabase** (cloud) | auth, database, billing webhook |

## Deploy (2 minutes, no CLI, no credentials to hand over)

1. **Enable SSL** first: hPanel → **Websites → SSL** → your domain → install (free, auto). Wait
   until it says active (usually minutes), the `.htaccess` forces HTTPS, so SSL must exist first.
2. Build is already done: **`saas/zengtrade-hostinger.zip`** (the site + Apache `.htaccess`).
3. hPanel → **Files → File Manager** → open **`public_html`**.
4. If `public_html` has Hostinger's default `index.html`/placeholder, delete it.
5. **Upload** `zengtrade-hostinger.zip` into `public_html` → right-click → **Extract** → delete the zip.
6. Visit **https://zengtrade.in**: landing loads; `/login.html` → sign up (Supabase magic link /
   OAuth); `/app.html` → the dashboard. Pricing shows the honest "opening soon" state until the
   Lemon Squeezy store is activated + variant IDs are set.

## Domain / DNS
`zengtrade.in` is already registered at Hostinger, so DNS is automatic once the site is in
`public_html`: nothing to change. (If the domain points elsewhere, hPanel → **Domains** → point
it at this hosting.)

## Re-deploying later
When code changes, rebuild the zip and re-upload:
```
cd saas/web && zip -r -X ../zengtrade-hostinger.zip . -x "_headers" -x "_redirects" -x ".DS_Store"
```
Then repeat steps 3–5 (upload + extract, overwrite).

## Notes
- **Hash routing**, so no server rewrites needed; the `.htaccess` only adds security headers,
  forces HTTPS, sets JS module MIME, and (optionally) pretty `/login` → `/login.html` paths.
- The Supabase URL + anon key + LS store slug in `config.js` are **public-safe** (RLS + the
  signed webhook are what protect data), fine to ship in a static site.
- No Cloudflare, no tunnel, no port-forwarding. The terminal never leaves your Mac.
