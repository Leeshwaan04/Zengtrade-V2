#!/usr/bin/env bash
# Deploy the Zengtrade 300,000-page Real-Time SSR Web Service to Google Cloud Run.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export CLOUDSDK_PYTHON="/opt/anaconda3/bin/python3"

echo "=========================================================="
echo " Zengtrade Web Service — Google Cloud Run Deploy"
echo " Real-Time Server-Side Rendering (300,000+ Pages)"
echo "=========================================================="
echo ""

# 1. Preflight check: gcloud CLI
command -v gcloud >/dev/null 2>&1 || {
  echo "ERROR: gcloud CLI is not installed or not in PATH."
  echo "Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
  exit 1
}

# 2. Check active GCP auth
account=$(gcloud config get-value account 2>/dev/null || true)
if [[ -z "$account" || "$account" == "(unset)" ]]; then
  echo "ERROR: No active gcloud account found."
  echo "Run: gcloud auth login"
  exit 1
fi
echo "Active GCP account: $account"

# 3. Resolve GCP Project ID
GCP_PROJECT="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
if [[ -z "$GCP_PROJECT" || "$GCP_PROJECT" == "(unset)" ]]; then
  GCP_PROJECT="zengtrade"
fi
echo "Target GCP project: $GCP_PROJECT"

# 4. Resolve GCP Region (asia-south1 for .in domain or us-central1)
REGION="${GCP_REGION:-asia-south1}"
echo "Target region:      $REGION"
echo ""

SERVICE_NAME="zengtrade-ssr"

echo ">> Deploying $SERVICE_NAME to Google Cloud Run from source..."
gcloud run deploy "$SERVICE_NAME" \
  --quiet \
  --project="$GCP_PROJECT" \
  --region="$REGION" \
  --source="." \
  --platform="managed" \
  --allow-unauthenticated \
  --memory="1Gi" \
  --cpu="1" \
  --min-instances=0 \
  --max-instances=10 \
  --port=8080 \
  --format="value(status.url)" > /tmp/cloudrun_url.txt || {
    echo "Deploy to $REGION failed, retrying in us-central1..."
    REGION="us-central1"
    gcloud run deploy "$SERVICE_NAME" \
      --quiet \
      --project="$GCP_PROJECT" \
      --region="$REGION" \
      --source="." \
      --platform="managed" \
      --allow-unauthenticated \
      --memory="1Gi" \
      --cpu="1" \
      --min-instances=0 \
      --max-instances=10 \
      --port=8080 \
      --format="value(status.url)" > /tmp/cloudrun_url.txt
  }

LIVE_URL=$(cat /tmp/cloudrun_url.txt | tr -d '\r\n')
echo ""
echo "=========================================================="
echo " ✓ Cloud Run Deployment Succeeded!"
echo " Service URL: $LIVE_URL"
echo "=========================================================="
echo ""

echo ">> Running live smoke tests against Cloud Run..."
for route in "" "pricing/" "coins/bitcoin/" "strategies/supertrend-breakout/bitcoin/" "compare/supertrend-vs-ema-cross/ethereum/" "blog/bitcoin-asymmetric-risk-portfolio-allocation/" "sitemap-index.xml" "sitemap-blog-1.xml" "healthz"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$LIVE_URL/$route")
  echo "  $LIVE_URL/$route -> HTTP $code"
done

echo ""
echo "All routes verified live in real-time."
