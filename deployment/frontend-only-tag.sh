#!/bin/sh
# Deployment-request tags for the frontend-only workflow.
#
# A tag name is exactly:
#   frontend-deploy/<release-sha>/<expected-production-sha>
# Both values are 40 lowercase hex characters. The tag object must peel to
# the release SHA. This script does not deploy and does not print secrets.
#
# Usage:
#   frontend-only-tag.sh format <release-sha> <expected-sha>
#   frontend-only-tag.sh parse <git-ref>
#   frontend-only-tag.sh verify <git-ref>
set -eu

die() {
  echo "$1" >&2
  exit 1
}

is_sha() {
  printf '%s' "$1" | grep -Eq '^[0-9a-f]{40}$'
}

normalize_ref() {
  ref=$1
  case "$ref" in
    refs/tags/frontend-deploy/*) printf '%s' "$ref" ;;
    frontend-deploy/*) printf '%s' "refs/tags/$ref" ;;
    *) die "TAG_MALFORMED" ;;
  esac
}

parse_ref() {
  full=$(normalize_ref "$1")
  rest=${full#refs/tags/frontend-deploy/}
  release=${rest%%/*}
  expected=${rest#*/}
  case "$expected" in
    */*) die "TAG_MALFORMED" ;;
  esac
  if [ "$release" = "$rest" ] || [ "$expected" = "$rest" ]; then
    die "TAG_MALFORMED"
  fi
  if ! is_sha "$release" || ! is_sha "$expected"; then
    die "TAG_MALFORMED"
  fi
  if [ "$release" = "$expected" ]; then
    die "TAG_MALFORMED"
  fi
  echo "RELEASE=$release"
  echo "EXPECTED=$expected"
}

field() {
  printf '%s\n' "$1" | awk -v key="$2" 'index($0, key"=") == 1 { print substr($0, length(key) + 2); exit }'
}

cmd=${1:-}
case "$cmd" in
  format)
    release=${2:-}
    expected=${3:-}
    if ! is_sha "$release" || ! is_sha "$expected" || [ "$release" = "$expected" ]; then
      die "TAG_MALFORMED"
    fi
    echo "frontend-deploy/$release/$expected"
    ;;
  parse)
    parse_ref "${2:-}"
    ;;
  verify)
    parsed=$(parse_ref "${2:-}")
    release=$(field "$parsed" RELEASE)
    full=$(normalize_ref "${2:-}")
    if ! git rev-parse --verify --quiet "${full}^{commit}" >/dev/null; then
      die "TAG_MISSING"
    fi
    peeled=$(git rev-parse "${full}^{commit}")
    if [ "$peeled" != "$release" ]; then
      echo "TAG_COMMIT_MISMATCH release=$release tag=$peeled" >&2
      exit 1
    fi
    printf '%s\n' "$parsed"
    echo "TAG_POINTS_AT_RELEASE"
    ;;
  *)
    die "UNKNOWN_TAG_COMMAND"
    ;;
esac
