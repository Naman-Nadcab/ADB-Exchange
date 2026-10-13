#!/bin/sh
# Map a workflow_dispatch or a frontend-deploy tag into one operation.
# Writes confirmation, release_sha, and expected_sha to GITHUB_OUTPUT when set.
# Does not contact production and does not print secrets.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

die() {
  echo "$1" >&2
  exit 1
}

emit() {
  printf '%s\n' "$1"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    printf '%s\n' "$1" >>"$GITHUB_OUTPUT"
  fi
}

field() {
  printf '%s\n' "$1" | awk -v key="$2" 'index($0, key"=") == 1 { print substr($0, length(key) + 2); exit }'
}

ensure_commit() {
  sha=$1
  if git cat-file -e "${sha}^{commit}" 2>/dev/null; then
    return 0
  fi
  git fetch --no-tags origin "$sha"
}

require_rollback_procedure() {
  if ! grep -q 'restore_previous_frontend' deployment/frontend-only-remote.sh; then
    die "ROLLBACK_PROCEDURE_MISSING"
  fi
  if ! grep -q 'ROLLBACK_FRONTEND_ONLY' .github/workflows/deploy-frontend-only.yml; then
    die "ROLLBACK_PROCEDURE_MISSING"
  fi
}

is_sha() {
  printf '%s' "$1" | grep -Eq '^[0-9a-f]{40}$'
}

deploy_checks() {
  release=$1
  expected=$2
  if ! is_sha "$release" || ! is_sha "$expected" || [ "$release" = "$expected" ]; then
    die "SHA_MALFORMED"
  fi
  ensure_commit "$release"
  ensure_commit "$expected"
  sh "$ROOT/deployment/frontend-only-preflight.sh" "$expected" "$release" >/dev/null
  require_rollback_procedure
  emit "confirmation=DEPLOY_FRONTEND_ONLY"
  emit "release_sha=$release"
  emit "expected_sha=$expected"
}

case "${EVENT_NAME:-}" in
  push)
    ref=${EVENT_REF:-}
    event_sha=${EVENT_SHA:-}
    default_branch=${DEFAULT_BRANCH:-}
    case "$ref" in
      refs/tags/frontend-inspect/*)
        expected=${ref#refs/tags/frontend-inspect/}
        case "$expected" in
          */*) die "TAG_MALFORMED" ;;
        esac
        if ! is_sha "$expected"; then
          die "TAG_MALFORMED"
        fi
        if [ -z "$default_branch" ] || [ -z "$event_sha" ]; then
          die "RUN_TAG_NOT_ON_DEFAULT_BRANCH"
        fi
        git fetch origin "$default_branch"
        tip=$(git rev-parse "origin/$default_branch")
        if [ "$tip" != "$event_sha" ]; then
          echo "RUN_TAG_NOT_ON_DEFAULT_BRANCH tip=$tip event=$event_sha" >&2
          exit 1
        fi
        require_rollback_procedure
        emit "confirmation=INSPECT_ONLY"
        emit "release_sha="
        emit "expected_sha=$expected"
        exit 0
        ;;
    esac
    parsed=$(sh "$ROOT/deployment/frontend-only-tag.sh" parse "$ref")
    role=$(field "$parsed" ROLE)
    release=$(field "$parsed" RELEASE)
    expected=$(field "$parsed" EXPECTED)
    if [ "$role" != "run" ]; then
      die "TAG_MALFORMED"
    fi
    if [ -z "$default_branch" ] || [ -z "$event_sha" ]; then
      die "RUN_TAG_NOT_ON_DEFAULT_BRANCH"
    fi
    git fetch origin "$default_branch"
    tip=$(git rev-parse "origin/$default_branch")
    if [ "$tip" != "$event_sha" ]; then
      echo "RUN_TAG_NOT_ON_DEFAULT_BRANCH tip=$tip event=$event_sha" >&2
      exit 1
    fi
    release_ref="refs/tags/frontend-deploy/$release/$expected"
    if ! git rev-parse --verify --quiet "${release_ref}^{commit}" >/dev/null; then
      if ! git fetch origin "$release_ref:$release_ref"; then
        die "TAG_MISSING"
      fi
    fi
    sh "$ROOT/deployment/frontend-only-tag.sh" verify-request "$ref" >/dev/null
    deploy_checks "$release" "$expected"
    ;;
  workflow_dispatch)
    confirmation=${INPUT_CONFIRMATION:-}
    case "$confirmation" in
      INSPECT_ONLY|ROLLBACK_FRONTEND_ONLY)
        require_rollback_procedure
        emit "confirmation=$confirmation"
        emit "release_sha="
        emit "expected_sha="
        ;;
      DEPLOY_FRONTEND_ONLY)
        deploy_checks "${INPUT_RELEASE:-}" "${INPUT_EXPECTED:-}"
        ;;
      *)
        die "REJECTED_CONFIRMATION"
        ;;
    esac
    ;;
  create)
    ref=${EVENT_REF:-}
    event_sha=${EVENT_SHA:-}
    parsed=$(sh "$ROOT/deployment/frontend-only-tag.sh" parse "$ref")
    release=$(field "$parsed" RELEASE)
    expected=$(field "$parsed" EXPECTED)
    case "$event_sha" in
      "$release") ;;
      *)
        echo "TAG_COMMIT_MISMATCH release=$release event=$event_sha" >&2
        exit 1
        ;;
    esac
    full=$ref
    case "$full" in
      refs/tags/*) ;;
      *) full="refs/tags/$full" ;;
    esac
    if ! git rev-parse --verify --quiet "${full}^{commit}" >/dev/null; then
      if ! git fetch origin "$full:$full"; then
        die "TAG_MISSING"
      fi
    fi
    sh "$ROOT/deployment/frontend-only-tag.sh" verify "$full" >/dev/null
    deploy_checks "$release" "$expected"
    ;;
  *)
    die "UNEXPECTED_EVENT"
    ;;
esac
