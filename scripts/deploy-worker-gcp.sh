#!/usr/bin/env bash
# Deploy the Zengtrade paper execution worker to Google Cloud Platform (Cloud Run).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=========================================================="
echo " Zengtrade Paper Worker — Google Cloud Platform Deploy"
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

# 4. Check billing status
billing_info=$(gcloud billing projects describe "$GCP_PROJECT" --format="json" 2>/dev/null || true)
billing_enabled=$(echo "$billing_info" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('billingEnabled', False))" 2>/dev/null || echo "False")

if [[ "$billing_enabled" != "True" ]]; then
  echo ""
  echo "⚠️  WARNING: Billing is NOT enabled on project '$GCP_PROJECT'."
  echo "Google Cloud Run and Cloud Build require an active billing account."
  echo "Please enable billing or link an open billing account here:"
  echo "  https://console.cloud.google.com/billing/linkedaccount?project=$GCP_PROJECT"
  echo ""
  echo "If you have another billing-enabled GCP project, specify it via:"
  echo "  GCP_PROJECT_ID=my-active-project ./scripts/deploy-worker-gcp.sh"
  echo ""
  if [[ -t 0 ]]; then
    read -r -p "Have you enabled/linked billing on this project? (y/N) " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
      echo "Aborting until billing is enabled on Google Cloud."
      exit 1
    fi
  else
    echo "ERROR: Project '$GCP_PROJECT' has billingEnabled=false. Enable billing in GCP Console before deploying."
    exit 1
  fi
fi

# 5. Region selection (asia-south1 is close to Supabase aws-0-ap-south-1; us-central1 is default free-tier)
GCP_REGION="${GCP_REGION:-asia-south1}"
echo "Target GCP region:  $GCP_REGION"

# 6. Resolve DATABASE_URL
DATABASE_URL="${DATABASE_URL:-}"
if [[ -z "$DATABASE_URL" ]]; then
  # Try resolving via helper script if DATABASE_PASSWORD is set
  resolved=$(./scripts/resolve-database-url.sh 2>/dev/null || true)
  if [[ -n "$resolved" ]]; then
    DATABASE_URL="$resolved"
  fi
fi

if [[ -z "$DATABASE_URL" ]]; then
  echo ""
  echo "DATABASE_URL is required for the worker to connect to Supabase."
  if [[ -n "${DATABASE_PASSWORD:-}" ]]; then
    DATABASE_URL="postgresql://postgres.ponvarxeytfcntckczbn:${DATABASE_PASSWORD}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
  elif [[ -t 0 ]]; then
    echo "Enter your Supabase database connection string"
    echo "(e.g. postgresql://postgres.ponvarxeytfcntckczbn:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres):"
    read -r -s -p "DATABASE_URL: " input_url
    echo ""
    DATABASE_URL="$input_url"
  else
    echo "ERROR: DATABASE_URL or DATABASE_PASSWORD must be provided in the environment."
    echo "Usage: DATABASE_PASSWORD='your_password' ./scripts/deploy-worker-gcp.sh"
    exit 1
  fi
fi

if [[ -z "$DATABASE_URL" ]]; then
  echo "ERROR: DATABASE_URL cannot be empty."
  exit 1
fi

# 7. Enable required GCP services
echo ""
echo ">> Verifying required GCP APIs (Cloud Run, Cloud Build, Artifact Registry)..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --project="$GCP_PROJECT"

# 8. Deploy to Cloud Run
SERVICE_NAME="zengtrade-paper-worker"
echo ""
echo ">> Deploying container to Cloud Run ($SERVICE_NAME) in $GCP_REGION..."
gcloud run deploy "$SERVICE_NAME" \
  --source="saas/worker" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --platform="managed" \
  --no-cpu-throttling \
  --min-instances=1 \
  --max-instances=1 \
  --memory="512Mi" \
  --cpu="1" \
  --set-env-vars="DATABASE_URL=${DATABASE_URL},WORKER_INTERVAL=300" \
  --allow-unauthenticated

# 9. Verify deployment
echo ""
echo ">> Deployment completed. Checking worker heartbeat in Supabase..."
sleep 5
./scripts/check-worker.sh || {
  echo "Worker deployed to Cloud Run, waiting for initial startup cycle..."
  sleep 10
  ./scripts/check-worker.sh || true
}

echo ""
echo "=========================================================="
echo " GCP Cloud Run Worker deployed successfully!"
echo " Monitor live at: https://console.cloud.google.com/run/detail/$GCP_REGION/$SERVICE_NAME/metrics?project=$GCP_PROJECT"
echo " Ops status:      https://zengtrade.in/ops/worker"
echo "=========================================================="
