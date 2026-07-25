#!/usr/bin/env bash
# zengtrade -- deploy the Polar billing webhook to Supabase. Run AFTER 'supabase login'.
# The signing secret is OPTIONAL at deploy time: without it the function deploys and REJECTS all
# events (fails closed, 401) -- which is what you want until you've created the Polar webhook and
# have its secret. Set it once you do:  supabase secrets set POLAR_WEBHOOK_SECRET=whsec_...
# Usage:  bash saas/deploy_polar.sh
set -euo pipefail
cd "$(dirname "$0")"
REF="ponvarxeytfcntckczbn"

if ! supabase projects list >/dev/null 2>&1; then
  echo "x not logged in. Run 'supabase login' first, then re-run this."
  exit 1
fi

echo "-> linking ${REF}"
supabase link --project-ref "${REF}"

if [ -n "${POLAR_WEBHOOK_SECRET:-}" ]; then
  echo "-> setting POLAR_WEBHOOK_SECRET"
  supabase secrets set "POLAR_WEBHOOK_SECRET=${POLAR_WEBHOOK_SECRET}"
else
  echo "!  POLAR_WEBHOOK_SECRET not set -- deploying anyway (function will 401 every event = safe)."
  echo "   After you create the Polar webhook, run:"
  echo "   supabase secrets set POLAR_WEBHOOK_SECRET=<whsec_... from Polar>"
fi

echo "-> deploying function"
supabase functions deploy polar-webhook

echo "-> verifying (forgery must return 401)"
node tests/polar_signature.mjs || true

echo ""
echo "Done. Point your Polar webhook at:"
echo "  https://${REF}.supabase.co/functions/v1/polar-webhook"
