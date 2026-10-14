#!/bin/sh
# Reject a backend release that is not a fast-forward of the production SHA
# or that touches anything outside apps/backend.
set -eu

EXPECTED=${1:-}
RELEASE=${2:-}

if [ -z "$EXPECTED" ] || [ -z "$RELEASE" ]; then
  echo "usage: backend-only-preflight.sh <expected-production-sha> <release-sha>" >&2
  exit 2
fi

git cat-file -e "${EXPECTED}^{commit}"
git cat-file -e "${RELEASE}^{commit}"

EXPECTED=$(git rev-parse "${EXPECTED}^{commit}")
RELEASE=$(git rev-parse "${RELEASE}^{commit}")

if [ "$EXPECTED" = "$RELEASE" ]; then
  echo "RELEASE_EQUALS_PRODUCTION" >&2
  exit 1
fi

if ! git merge-base --is-ancestor "$EXPECTED" "$RELEASE"; then
  echo "RELEASE_IS_NOT_DESCENDANT" >&2
  exit 1
fi

files=$(git diff --name-only "$EXPECTED" "$RELEASE")
if [ -z "$files" ]; then
  echo "EMPTY_DIFF" >&2
  exit 1
fi

disallowed=$(printf '%s\n' "$files" | grep -v '^apps/backend/' || true)
if [ -n "$disallowed" ]; then
  echo "DISALLOWED_PATHS" >&2
  printf '%s\n' "$disallowed" | head -40 >&2
  exit 1
fi

echo "PREFLIGHT_OK"
echo "EXPECTED=$EXPECTED"
echo "RELEASE=$RELEASE"
printf '%s\n' "$files"
