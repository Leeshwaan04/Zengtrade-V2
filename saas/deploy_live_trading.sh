#!/usr/bin/env bash
# zengtrade: deploy the real (non-custodial) Binance execution functions to Supabase.
# Run AFTER `supabase login`, and AFTER the two isolated test suites pass locally.
#
# Secrets are read from gitignored files (never args/history):
#   saas/.exchange_key_enc_master   <- 32 random bytes, base64. Generate ONCE:
#                                        openssl rand -base64 32 > saas/.exchange_key_enc_master
#                                      Losing this makes every stored exchange key permanently
#                                      undecryptable for every user - keep a secure offline backup.
#   saas/.live_max_order_notional_usd <- the per-order real-money cap, e.g. `printf %s 50`.
#                                         This is a risk-tolerance number, not a technical one -
#                                         pick it deliberately, not by copying a placeholder.
# Optional:
#   saas/.live_max_daily_orders     <- daily order-count cap (default 20 if this file is absent)
#   saas/.binance_force_testnet     <- contents "1" to point at testnet.binance.vision instead of
#                                       mainnet. Leave this file absent/empty for production.
# Create them WITHOUT echoing to the terminal, e.g.:
#   umask 077
#   openssl rand -base64 32 > saas/.exchange_key_enc_master
#   printf %s '50' > saas/.live_max_order_notional_usd
#
# Usage:  bash saas/deploy_live_trading.sh
set -euo pipefail
cd "$(dirname "$0")"
REF="ponvarxeytfcntckczbn"

command -v supabase >/dev/null || { echo "x supabase CLI not found. Install it, then re-run."; exit 1; }
supabase projects list >/dev/null 2>&1 || { echo "x not logged in. Run 'supabase login' first."; exit 1; }
[ -s .exchange_key_enc_master ]        || { echo "x missing saas/.exchange_key_enc_master (see header)"; exit 1; }
[ -s .live_max_order_notional_usd ]    || { echo "x missing saas/.live_max_order_notional_usd - pick a real per-order cap, see header"; exit 1; }

echo "-> verifying signing + encryption locally before touching anything real"
node tests/binance_signing.mjs
node tests/exchange_key_crypto.mjs

echo "-> linking ${REF}"
supabase link --project-ref "${REF}"

echo "-> applying the exchange_connection / live_order migration"
supabase db push

SECRETS=(
  "EXCHANGE_KEY_ENC_MASTER=$(cat .exchange_key_enc_master)"
  "LIVE_MAX_ORDER_NOTIONAL_USD=$(cat .live_max_order_notional_usd)"
)
[ -s .live_max_daily_orders ]  && SECRETS+=("LIVE_MAX_DAILY_ORDERS=$(cat .live_max_daily_orders)")
[ -s .binance_force_testnet ]  && SECRETS+=("BINANCE_FORCE_TESTNET=$(cat .binance_force_testnet)")

echo "-> setting secrets (values never printed)"
supabase secrets set "${SECRETS[@]}"

echo "-> deploying functions"
supabase functions deploy exchange-connect
supabase functions deploy place-order

echo ""
echo "Done. Before any real user gets access:"
echo "  1. Smoke-test the connect + order flow against testnet (saas/.binance_force_testnet = 1)."
echo "  2. Place ONE real order yourself, smallest possible size, on mainnet."
echo "  3. Only then consider general availability - see the plan's staged-rollout notes."
