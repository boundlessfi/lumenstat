#!/usr/bin/env bash
# Writes the commits made on top of the pinned Umami tag into patches/umami.
set -euo pipefail
cd "$(dirname "$0")/.."

UMAMI_TAG="${UMAMI_TAG:-v3.5.0}"
base="$(git -C vendor/umami rev-parse "${UMAMI_TAG}^{commit}" 2>/dev/null || git -C vendor/umami rev-list --max-parents=0 HEAD | tail -1)"

rm -f patches/umami/*.patch
mkdir -p patches/umami
git -C vendor/umami format-patch --quiet --zero-commit --no-signature -o "$PWD/patches/umami" "$base..HEAD"
ls patches/umami
