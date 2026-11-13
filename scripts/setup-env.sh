#!/usr/bin/env bash
# Writes .env with random secrets, unless it already exists.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo ".env already exists; leaving it alone."
  exit 0
fi

rand() { openssl rand -base64 36 | tr -d '/+=\n' | cut -c1-40; }

cat > .env <<EOF
POSTGRES_PASSWORD=$(rand)
UMAMI_APP_SECRET=$(rand)
SCF_COLLECTOR_SECRET=$(rand)
SCF_BOOTSTRAP_OPERATOR_KEY=$(rand)
TEST_API_INGEST_KEY=
EOF

chmod 600 .env
echo "Wrote .env with random secrets."
