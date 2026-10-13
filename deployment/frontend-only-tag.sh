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
    refs/tags/frontend-deploy-run/*|refs/tags/frontend-deploy/*) printf '%s' "$ref" ;;
    frontend-deploy-run/*|frontend-deploy/*) printf '%s' "refs/tags/$ref" ;;
    *) die "TAG_MALFORMED" ;;
  esac
}

tag_role() {
  full=$1
  case "$full" in
    refs/tags/frontend-deploy-run/*) printf '%s' run ;;
    refs/tags/frontend-deploy/*) printf '%s' release ;;
    *) die "TAG_MALFORMED" ;;
  esac
}

parse_ref() {
  full=$(normalize_ref "$1")
  role=$(tag_role "$full")
  case "$role" in
    run) rest=${full#refs/tags/frontend-deploy-run/} ;;
    release) rest=${full#refs/tags/frontend-deploy/} ;;
  esac
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
  echo "ROLE=$role"
  echo "RELEASE=$release"
  echo "EXPECTED=$expected"
}

field() {
  printf '%s\n' "$1" | awk -v key="$2" 'index($0, key"=") == 1 { print substr($0, length(key) + 2); exit }'
}

cmd=${1:-}
case "$cmd" in
  format|format-run)
    release=${2:-}
    expected=${3:-}
    if ! is_sha "$release" || ! is_sha "$expected" || [ "$release" = "$expected" ]; then
      die "TAG_MALFORMED"
    fi
    if [ "$cmd" = "format-run" ]; then
      echo "frontend-deploy-run/$release/$expected"
    else
      echo "frontend-deploy/$release/$expected"
    fi
    ;;
  parse)
    parse_ref "${2:-}"
    ;;
  verify)
    parsed=$(parse_ref "${2:-}")
    release=$(field "$parsed" RELEASE)
    role=$(field "$parsed" ROLE)
    if [ "$role" != "release" ]; then
      die "TAG_MALFORMED"
    fi
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
  verify-request)
    parsed=$(parse_ref "${2:-}")
    role=$(field "$parsed" ROLE)
    release=$(field "$parsed" RELEASE)
    expected=$(field "$parsed" EXPECTED)
    if [ "$role" != "run" ]; then
      die "TAG_MALFORMED"
    fi
    release_ref="refs/tags/frontend-deploy/$release/$expected"
    sh "$0" verify "$release_ref"
    echo "RUN_TAG_ACCEPTED"
    ;;
  *)
    die "UNKNOWN_TAG_COMMAND"
    ;;
esac
