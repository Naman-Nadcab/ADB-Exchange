#!/bin/sh
# Tag parser, ancestry, and frontend-only path checks. Does not deploy.
set -eu

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
tag=$root/deployment/frontend-only-tag.sh
preflight=$root/deployment/frontend-only-preflight.sh
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

cd "$work"
git init -q
git config user.email tag-test@example.com
git config user.name tag-test

mkdir -p apps/frontend apps/backend
printf '%s\n' base > apps/frontend/app.txt
printf '%s\n' api > apps/backend/api.txt
git add apps
git commit -q -m base
base=$(git rev-parse HEAD)

printf '%s\n' overview > apps/frontend/app.txt
git add apps/frontend/app.txt
git commit -q -m frontend
release=$(git rev-parse HEAD)

git checkout -q -b other "$base"
printf '%s\n' changed > apps/backend/api.txt
git add apps/backend/api.txt
git commit -q -m backend
backend=$(git rev-parse HEAD)
git checkout -q master 2>/dev/null || git checkout -q main

other=0123456789abcdef0123456789abcdef01234567

run() {
  set +e
  out=$(sh "$@" 2>&1)
  code=$?
  set -e
  printf '%s\n' "$out"
  return "$code"
}

expect_fail() {
  label=$1
  want=$2
  shift 2
  if out=$(run "$@"); then
    echo "FAIL $label unexpectedly passed" >&2
    printf '%s\n' "$out" >&2
    exit 1
  fi
  if ! printf '%s\n' "$out" | grep -q "$want"; then
    echo "FAIL $label missing $want" >&2
    printf '%s\n' "$out" >&2
    exit 1
  fi
  echo "PASS $label"
}

name=$(sh "$tag" format "$release" "$base")
test "$name" = "frontend-deploy/$release/$base"
git tag "$name" "$release"
parsed=$(sh "$tag" verify "refs/tags/$name")
printf '%s\n' "$parsed" | grep -q "^RELEASE=$release$"
printf '%s\n' "$parsed" | grep -q "^EXPECTED=$base$"
printf '%s\n' "$parsed" | grep -q '^TAG_POINTS_AT_RELEASE$'
sh "$preflight" "$base" "$release" | grep -q '^PREFLIGHT_OK$'
echo "PASS valid_deployment_request_tag"

expect_fail malformed_release TAG_MALFORMED "$tag" format "zzzz" "$base"
expect_fail malformed_base TAG_MALFORMED "$tag" parse "refs/tags/frontend-deploy/$release/not-a-sha"
expect_fail short_sha TAG_MALFORMED "$tag" parse "refs/tags/frontend-deploy/${release%?}?/$base"
expect_fail uppercase_sha TAG_MALFORMED "$tag" parse "refs/tags/frontend-deploy/$(printf '%s' "$release" | tr 'a-f' 'A-F')/$base"
expect_fail equal_shas TAG_MALFORMED "$tag" format "$base" "$base"
expect_fail unrelated_prefix TAG_MALFORMED "$tag" parse "refs/tags/v1.2.3"
expect_fail branch_ref TAG_MALFORMED "$tag" parse "refs/heads/frontend-deploy/$release/$base"

wrong_name="frontend-deploy/$other/$base"
git tag "$wrong_name" "$release"
expect_fail incorrect_release_sha TAG_COMMIT_MISMATCH "$tag" verify "refs/tags/$wrong_name"

bad_base_name="frontend-deploy/$release/$backend"
git tag "$bad_base_name" "$release"
sh "$tag" verify "refs/tags/$bad_base_name" >/dev/null
expect_fail incorrect_base_sha RELEASE_IS_NOT_DESCENDANT "$preflight" "$backend" "$release"

wrong_point="frontend-deploy/$release/$other"
git tag "$wrong_point" "$base"
expect_fail tag_points_at_wrong_commit TAG_COMMIT_MISMATCH "$tag" verify "refs/tags/$wrong_point"

non_frontend="frontend-deploy/$backend/$base"
git tag "$non_frontend" "$backend"
sh "$tag" verify "refs/tags/$non_frontend" >/dev/null
expect_fail non_frontend_only DISALLOWED_PATHS "$preflight" "$base" "$backend"

if grep -q 'frontend-deploy' "$root/.github/workflows/production.yml"; then
  echo "FAIL full-stack workflow references the frontend deploy tag" >&2
  exit 1
fi
echo "PASS full_stack_workflow_untouched"

if ! grep -q 'restore_previous_frontend' "$root/deployment/frontend-only-remote.sh"; then
  echo "FAIL rollback procedure missing" >&2
  exit 1
fi
echo "PASS rollback_procedure_present"

echo "TAG_TESTS_OK"
