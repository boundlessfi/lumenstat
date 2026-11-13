#!/usr/bin/env bash
# Rebuilds vendor/umami from the pinned upstream tag plus our patches.
#
# Our changes to Umami live in patches/umami as plain `git format-patch` files,
# so every upgrade is a reviewed diff: bump UMAMI_TAG, run this, fix conflicts,
# then re-export with scripts/export-umami-patches.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

UMAMI_TAG="${UMAMI_TAG:-v3.5.0}"
UMAMI_REPO="${UMAMI_REPO:-https://github.com/umami-software/umami.git}"

rm -rf vendor/umami
git clone --quiet --depth 1 --branch "$UMAMI_TAG" "$UMAMI_REPO" vendor/umami
git -C vendor/umami am --quiet patches/umami/*.patch

echo "vendor/umami = $UMAMI_TAG + $(ls patches/umami/*.patch | wc -l | tr -d ' ') patches"
git -C vendor/umami log --oneline -n "$(ls patches/umami/*.patch | wc -l)"
