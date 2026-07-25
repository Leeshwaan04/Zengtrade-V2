#!/usr/bin/env bash
# zengtrade — deploy the Lemon Squeezy billing webhook to Supabase.
# Everything is prepared (function written + tested, config.toml linked, verify_jwt=false).
# The ONLY thing this needs that a machine can't do for you is authenticating as YOU.
#
# ── One-time setup (you do this once) ────────────────────────────────────────────────
#   Option A (interactive):   supabase login          # opens a browser, ~10s
#   Option B (headless/CI):   export SUPABASE_ACCESS_TOKEN=<token from
#                             https://supabase.com/dashboard/account/tokens>
#
# ── Then just run this script ────────────────────────────────────────────────────────
#   cd saas && bash deploy_webhook.sh
#
set -euo pipefail
REF="ponvarxeytfcntckczbn"
cd "$(dirname "$0")"

echo "▸ linking project $REF …"
supabase link --project-ref "$REF"

echo "▸ deploying lemonsqueezy-webhook …"
supabase functions deploy lemonsqueezy-webhook

# The signing secret is what lets REAL billing events through. Get it from Lemon Squeezy →
# Settings → Webhooks → your endpoint's signing secret. (Do NOT reuse the one leaked earlier —
# rotate it in LS first, then paste the fresh value below.)
if [ -n "${LEMONSQUEEZY_WEBHOOK_SECRET:-}" ]; then
  echo "▸ setting LEMONSQUEEZY_WEBHOOK_SECRET …"
  supabase secrets set "LEMONSQUEEZY_WEBHOOK_SECRET=$LEMONSQUEEZY_WEBHOOK_SECRET"
else
  echo "⚠  LEMONSQUEEZY_WEBHOOK_SECRET not set — the function will deploy and REJECT all events"
  echo "   (fails closed, which is safe). To accept real billing events, run:"
  echo "   supabase secrets set LEMONSQUEEZY_WEBHOOK_SECRET=<fresh LS signing secret>"
fi

echo
echo "✓ deployed. Endpoint:"
echo "  https://$REF.supabase.co/functions/v1/lemonsqueezy-webhook"
echo "▸ verify it fails closed on a forgery (should print 10/10, live tier now 401 not 404):"
echo "  node tests/webhook_signature.mjs"
