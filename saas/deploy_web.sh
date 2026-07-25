#!/usr/bin/env bash
# zengtrade -- deploy the public SaaS site (saas/web) to Cloudflare Pages.
# One-time: 'wrangler login' (opens your browser, authenticates as you).
# Then:     bash saas/deploy_web.sh
set -euo pipefail
cd "$(dirname "$0")"
PROJECT="zengtrade"

if ! wrangler whoami >/dev/null 2>&1; then
  echo "x not logged in to Cloudflare. Run 'wrangler login' first, then re-run this."
  exit 1
fi

echo "-> deploying saas/web to Cloudflare Pages project '${PROJECT}'"
wrangler pages deploy web --project-name="${PROJECT}"

cat <<EOF

Done. Cloudflare gives you a *.pages.dev URL. To serve it on your domain:
  Cloudflare dashboard -> Pages -> ${PROJECT} -> Custom domains -> add
    zengtrade.in   (and/or www.zengtrade.in)
Then it is live once DNS is on Cloudflare (see deploy/DEPLOY.md step 1).
EOF
