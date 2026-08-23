#!/usr/bin/env bash
# Deploy NOWPayments edge functions (requires supabase CLI + project link).
set -euo pipefail
cd "$(dirname "$0")/../saas"
echo "Deploying nowpayments-create-invoice and nowpayments-ipn..."
supabase functions deploy nowpayments-create-invoice --no-verify-jwt
supabase functions deploy nowpayments-ipn --no-verify-jwt
echo "Done. Ensure secrets are set:"
echo "  supabase secrets set NOWPAYMENTS_API_KEY=..."
echo "  supabase secrets set NOWPAYMENTS_IPN_SECRET=..."
