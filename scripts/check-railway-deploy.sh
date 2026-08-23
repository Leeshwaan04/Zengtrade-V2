#!/usr/bin/env bash
# Report paper-worker Railway deploy status (requires RAILWAY_API_TOKEN).
# Does not print secret values — only whether DATABASE_URL is configured.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=/dev/null
source "$ROOT/scripts/railway-api.sh"

PROJECT_ID="${RAILWAY_PROJECT_ID:-f5902ffd-5b3f-49ed-b87d-dad21568185b}"
ENV_ID="${RAILWAY_ENV_ID:-354b0010-b9a7-48ef-a809-c239f9469fa9}"
SERVICE_ID="${RAILWAY_SERVICE_ID:-0decae25-fab5-44f1-aefa-af6fcd5f070a}"

vars_json=$(railway_gql 'query($p: String!, $e: String!, $s: String!) { variables(projectId: $p, environmentId: $e, serviceId: $s) }' \
  "$(python3 -c "import json; print(json.dumps({'p':'$PROJECT_ID','e':'$ENV_ID','s':'$SERVICE_ID'}))")")

has_db=$(echo "$vars_json" | python3 -c "import sys,json; v=json.load(sys.stdin).get('data',{}).get('variables') or {}; print('yes' if 'DATABASE_URL' in v else 'no')")

dep_json=$(railway_gql 'query($s: String!, $e: String!) { serviceInstance(serviceId: $s, environmentId: $e) { latestDeployment { status createdAt } } }' \
  "$(python3 -c "import json; print(json.dumps({'s':'$SERVICE_ID','e':'$ENV_ID'}))")")

read -r dep_status dep_at <<<"$(echo "$dep_json" | python3 -c "
import sys,json
d=json.load(sys.stdin).get('data',{}).get('serviceInstance',{}).get('latestDeployment') or {}
print(d.get('status','UNKNOWN'), (d.get('createdAt') or '')[:19])
")"

if [[ "$has_db" == "yes" ]]; then
  echo "Railway paper-worker: DATABASE_URL set · latest deploy $dep_status ($dep_at UTC)"
  if [[ "$dep_status" == "FAILED" || "$dep_status" == "CRASHED" ]]; then
    echo "HINT: deploy failed — often wrong Postgres password in DATABASE_URL (see /ops/worker)"
  fi
else
  echo "Railway paper-worker: DATABASE_URL missing · latest deploy $dep_status ($dep_at UTC)"
fi

case "$dep_status" in
  SUCCESS) exit 0 ;;
  FAILED|CRASHED) exit 1 ;;
  *) exit 2 ;;
esac
