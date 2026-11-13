#!/usr/bin/env bash
# Creates the example API tenant and an operator read key, and stores the
# tenant's ingest key in .env as TEST_API_INGEST_KEY.
#
# Usage: scripts/create-api-tenant.sh [tenant name]
# Runs the writer CLI on the host when DATABASE_URL is set, else inside the writer container.
set -euo pipefail
cd "$(dirname "$0")/.."

name="${1:-SCF test API}"

run_cli() {
  if [ -n "${DATABASE_URL:-}" ]; then
    (cd apps/writer && node "$@")
  else
    docker compose exec -T writer node "$@"
  fi
}

tenant_json="$(run_cli src/cli/tenant-create.ts "$name")"
ingest_key="$(printf '%s' "$tenant_json" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).ingestKey))')"
tenant_id="$(printf '%s' "$tenant_json" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).tenantId))')"

if grep -q '^TEST_API_INGEST_KEY=' .env; then
  sed -i.bak "s|^TEST_API_INGEST_KEY=.*|TEST_API_INGEST_KEY=${ingest_key}|" .env && rm -f .env.bak
else
  printf 'TEST_API_INGEST_KEY=%s\n' "$ingest_key" >> .env
fi

echo "Tenant ${tenant_id} (${name}) created; ingest key saved to .env as TEST_API_INGEST_KEY."
echo "A tenant-scoped read key for its dashboard:"
run_cli src/cli/key-create.ts --label "${name} dashboard" --tenant "$tenant_id"
