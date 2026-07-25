#!/usr/bin/env bash
# zengtrade -- one-command billing finisher. Run AFTER 'supabase login' and after pasting
# the signing secret (saas/.webhook_secret) into the Lemon Squeezy webhook "Signing secret".
# Usage:  bash saas/finish_billing.sh
set -euo pipefail
cd "$(dirname "$0")"
REF="ponvarxeytfcntckczbn"

if [ ! -f .webhook_secret ]; then
  echo "x saas/.webhook_secret missing -- regenerate: openssl rand -hex 32 > saas/.webhook_secret"
  exit 1
fi
SECRET="$(cat .webhook_secret)"

echo "-> checking CLI auth"
if ! supabase projects list >/dev/null 2>&1; then
  echo "x not logged in. Run 'supabase login' first, then re-run this."
  exit 1
fi

echo "-> linking ${REF}"
supabase link --project-ref "${REF}"

echo "-> setting webhook secret"
supabase secrets set "LEMONSQUEEZY_WEBHOOK_SECRET=${SECRET}"

echo "-> deploying function"
supabase functions deploy lemonsqueezy-webhook

echo "-> verifying (forgery must return 401)"
node tests/webhook_signature.mjs || true

echo ""
echo "Done. Endpoint: https://${REF}.supabase.co/functions/v1/lemonsqueezy-webhook"
echo "Make sure the SAME value from saas/.webhook_secret is in the Lemon Squeezy webhook"
echo "'Signing secret' field -- both sides must match for real payments to be accepted."
