#!/usr/bin/env bash
# Copies the immutable tracker releases into Umami's public folder, so the Umami
# image serves packages/tracker/releases/<version>.js at /v/<version>/l.js.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -d vendor/umami/public ] || { echo "vendor/umami is missing; run scripts/sync-umami.sh first." >&2; exit 1; }

for file in packages/tracker/releases/*.js; do
  version="$(basename "$file" .js)"
  mkdir -p "vendor/umami/public/v/$version"
  cp "$file" "vendor/umami/public/v/$version/l.js"
done
echo "Staged tracker releases: $(ls packages/tracker/releases | sed 's/\.js$//' | tr '\n' ' ')"
