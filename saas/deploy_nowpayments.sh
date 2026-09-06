#!/usr/bin/env bash
# zengtrade: deploy the NOWPayments billing functions to Supabase. Run AFTER `supabase login`.
#
# Secrets are read from gitignored files (never args/history):
#   saas/.nowpayments_api_key      <- your NOWPayments API key   (Integrations → API key)
#   saas/.nowpayments_ipn_secret   <- your NOWPayments IPN secret (Integrations → IPN key, shown once)
# Create them WITHOUT echoing to the terminal, e.g. with a small editor or:
#   printf %s 'YOUR_ROTATED_API_KEY'   > saas/.nowpayments_api_key   && chmod 600 saas/.nowpayments_api_key
#   printf %s 'YOUR_ROTATED_IPN_KEY'   > saas/.nowpayments_ipn_secret && chmod 600 saas/.nowpayments_ipn_secret
# (Use the ROTATED keys: regenerate them in NOWPayments first, since the originals were exposed.)
#
# Usage:  bash saas/deploy_nowpayments.sh
set -euo pipefail
cd "$(dirname "$0")"
REF="ponvarxeytfcntckczbn"

command -v supabase >/dev/null || { echo "x supabase CLI not found. Install it, then re-run."; exit 1; }
supabase projects list >/dev/null 2>&1 || { echo "x not logged in. Run 'supabase login' first."; exit 1; }
[ -s .nowpayments_api_key ]    || { echo "x missing saas/.nowpayments_api_key (see header)";    exit 1; }
[ -s .nowpayments_ipn_secret ] || { echo "x missing saas/.nowpayments_ipn_secret (see header)"; exit 1; }

echo "-> verifying the IPN signature logic before deploy"
node tests/nowpayments_signature.mjs

echo "-> linking ${REF}"
supabase link --project-ref "${REF}"

echo "-> setting secrets (values never printed)"
supabase secrets set \
  "NOWPAYMENTS_API_KEY=$(cat .nowpayments_api_key)" \
  "NOWPAYMENTS_IPN_SECRET=$(cat .nowpayments_ipn_secret)"

echo "-> deploying functions"
supabase functions deploy nowpayments-ipn
supabase functions deploy nowpayments-create-invoice

echo "-> applying the pay-per-period migration"
echo "   (run this in the SQL editor or via 'supabase db push': db/migrations/0003_paid_period_downgrade.sql)"

echo ""
echo "Done. In NOWPayments → Integrations → 'Set up notifications', set the IPN URL to:"
echo "  https://${REF}.supabase.co/functions/v1/nowpayments-ipn"
echo "Then make one small real payment and confirm the function logs show 'finished -> until ...'."
