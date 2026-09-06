#!/usr/bin/env bash
# Railway GraphQL helper: account tokens use RAILWAY_API_TOKEN (not RAILWAY_TOKEN).
set -euo pipefail

RAILWAY_API="${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}"
[[ -n "$RAILWAY_API" ]] || { echo "ERROR: set RAILWAY_API_TOKEN" >&2; exit 1; }

railway_gql() {
  local query="$1"
  local variables="${2-}"
  [[ -n "$variables" ]] || variables='{}'
  local payload
  payload=$(python3 -c 'import json,sys; print(json.dumps({"query": sys.argv[1], "variables": json.loads(sys.argv[2])}))' "$query" "$variables")
  curl -sfL https://backboard.railway.com/graphql/v2 \
    -H "Authorization: Bearer $RAILWAY_API" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

railway_set_vars() {
  local project_id="$1" env_id="$2" service_id="$3"
  shift 3
  local vars_json variables
  vars_json=$(python3 -c "import json,sys; print(json.dumps(dict(a.split('=',1) for a in sys.argv[1:])))" "$@")
  variables=$(PROJECT_ID="$project_id" ENV_ID="$env_id" SERVICE_ID="$service_id" VARS="$vars_json" python3 -c '
import json, os
print(json.dumps({"input": {
  "projectId": os.environ["PROJECT_ID"],
  "environmentId": os.environ["ENV_ID"],
  "serviceId": os.environ["SERVICE_ID"],
  "variables": json.loads(os.environ["VARS"]),
  "skipDeploys": True,
}}))
')
  railway_gql 'mutation($input: VariableCollectionUpsertInput!) { variableCollectionUpsert(input: $input) }' "$variables" >/dev/null
}

railway_redeploy() {
  local env_id="$1" service_id="$2"
  local variables
  variables=$(python3 -c "import json; print(json.dumps({'e': '$env_id', 's': '$service_id'}))")
  railway_gql 'mutation($e: String!, $s: String!) { serviceInstanceRedeploy(environmentId: $e, serviceId: $s) }' "$variables" >/dev/null
}

railway_configure_worker_service() {
  local env_id="${RAILWAY_ENV_ID:-354b0010-b9a7-48ef-a809-c239f9469fa9}"
  local service_id="${RAILWAY_SERVICE_ID:-0decae25-fab5-44f1-aefa-af6fcd5f070a}"
  local variables

  variables=$(python3 -c "import json; print(json.dumps({'serviceId': '$service_id', 'environmentId': '$env_id', 'input': {'rootDirectory': 'saas/worker', 'dockerfilePath': 'Dockerfile', 'railwayConfigFile': 'railway.toml', 'startCommand': 'python worker.py --interval 300'}}))")
  railway_gql 'mutation($input: ServiceInstanceUpdateInput!, $serviceId: String!, $environmentId: String) { serviceInstanceUpdate(input: $input, serviceId: $serviceId, environmentId: $environmentId) }' "$variables" >/dev/null
  echo "$service_id"
}

# Back-compat alias: configure only (deploy separately to avoid double deploy).
railway_ensure_worker_service() {
  railway_configure_worker_service
}

# Find DATABASE_URL on any service in the project (does not print discovery path).
railway_resolve_database_url() {
  local project_id="${RAILWAY_PROJECT_ID:-f5902ffd-5b3f-49ed-b87d-dad21568185b}"
  local env_id="${RAILWAY_ENV_ID:-354b0010-b9a7-48ef-a809-c239f9469fa9}"
  local services_json vars_json sid url

  services_json=$(railway_gql 'query($id: String!) { project(id: $id) { services { edges { node { id } } } } }' \
    "$(python3 -c "import json; print(json.dumps({'id': '$project_id'}))")")

  while IFS= read -r sid; do
    [[ -n "$sid" ]] || continue
    vars_json=$(railway_gql 'query($p: String!, $e: String!, $s: String!) { variables(projectId: $p, environmentId: $e, serviceId: $s) }' \
      "$(python3 -c "import json; print(json.dumps({'p':'$project_id','e':'$env_id','s':'$sid'}))")")
    url=$(echo "$vars_json" | python3 -c "import sys,json; v=(json.load(sys.stdin).get('data') or {}).get('variables') or {}; print(v.get('DATABASE_URL',''))")
    if [[ -n "$url" ]]; then
      echo "$url"
      return 0
    fi
  done < <(echo "$services_json" | python3 -c "
import sys, json
edges = (json.load(sys.stdin).get('data') or {}).get('project', {}).get('services', {}).get('edges') or []
for e in edges:
    print(e['node']['id'])
")
  return 1
}
