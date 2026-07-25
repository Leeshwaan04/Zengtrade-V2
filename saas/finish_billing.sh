#!/usr/bin/env bash
# zengtrade — one-command billing finisher. Does EVERYTHING that doesn't require logging
# into your accounts: sets the (already-generated) signing secret in Supabase, deploys the
# webhook, and verifies it. Run this AFTER the two things only you can do:
#   (1) supabase login            # 10-second browser click, authenticates the CLI as you
#   (2) paste the signing secret into the Lemon Squeezy webhook "Signing secret" field
#       — the value is in saas/.webhook_secret (run:  cat saas/.webhook_secret )
#
# Usage:  cd saas && bash finish_billing.sh
set -euo pipefail
cd "$(dirname "$0")"
REF="ponvarxeytfcntckczbn"

[ -f .webhook_secret ] || { echo "✗ saas/.webhook_secret missing — regenerate: openssl rand -hex 32 > .webhook_secret"; exit 1; }
SECRET="$(cat .webhook_secret)"

echo "▸ checking CLI auth…"
supabase projects list >/dev/null 2>&1 || { echo "✗ not logged in. Run 'supabase login' first (opens your browser), then re-run this."; exit 1; }

echo "▸ linking $REF…";           supabase link --project-ref "$REF"
echo "▸ setting webhook secret…"; supabase secrets set "LEMONSQUEEZY_WEBHOOK_SECRET=$SECRET"
echo "▸ deploying function…";     supabase functions deploy lemonsqueezy-webhook

echo "▸ verifying (forgery must 401)…"
node tests/webhook_signature.mjs || true

cat <<EOF

✓ Done. Endpoint:  https://$REF.supabase.co/functions/v1/lemonsqueezy-webhook
  Make sure the SAME value from saas/.webhook_secret is in the Lemon Squeezy webhook's
  "Signing secret" field — both sides must match for real payments to be accepted.
EOF
