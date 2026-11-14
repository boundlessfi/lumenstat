#!/usr/bin/env bash
# Runs on YOUR MACHINE. Copies the working tree to the server and runs bootstrap.sh.
# Usage: deploy/deploy.sh <ssh host>   (an alias from your ~/.ssh/config, or user@host)
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="${1:?usage: deploy/deploy.sh <ssh host>}"

[ -d vendor/umami/src ] || { echo "vendor/umami is missing; run scripts/sync-umami.sh first." >&2; exit 1; }
node scripts/build-tracker.mjs --check   # the released tracker must match the patched source
scripts/stage-tracker-releases.sh

ssh "$HOST" 'sudo install -d -o "$(id -un)" -g "$(id -gn)" -m 750 /srv/lumenstat /srv/lumenstat/src'

# Ship sources only: no dependencies, build output, local env files or git history.
COPYFILE_DISABLE=1 tar --no-xattrs -czf - \
  --exclude='node_modules' --exclude='.next' --exclude='.git' --exclude='.env' --exclude='.env.*' --exclude='.claude' \
  --exclude='*.tsbuildinfo' --exclude='examples/test-site/*.html' \
  apps deploy vendor/umami patches README.md LICENSE \
  | ssh "$HOST" 'tar -xzf - -C /srv/lumenstat/src'

ssh "$HOST" 'bash /srv/lumenstat/src/deploy/bootstrap.sh'
