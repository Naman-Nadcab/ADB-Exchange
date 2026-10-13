#!/bin/sh
# Focused checks for the production .deploy-rev exception.
set -eu

script=$(CDPATH= cd -- "$(dirname "$0")" && pwd)/frontend-only-tree-status.sh
root=$(mktemp -d)
trap 'rm -rf "$root"' EXIT

cd "$root"
git init -q
git config user.email tree-status@example.com
git config user.name tree-status
printf '%s\n' 8ef599983974e84679bf44010ca3d8154785665a > .deploy-rev
printf '%s\n' tracked > tracked.txt
git add .deploy-rev tracked.txt
git commit -q -m init
head_sha=$(git rev-parse HEAD)

run_status() {
  set +e
  out=$(sh "$script")
  code=$?
  set -e
  printf '%s\n' "$out"
  return "$code"
}

expect_ok() {
  label=$1
  want=$2
  if out=$(run_status); then
    code=0
  else
    code=$?
  fi
  if [ "$code" -ne 0 ] || [ "$out" != "$want" ]; then
    echo "FAIL $label code=$code out=$out" >&2
    exit 1
  fi
  echo "PASS $label"
}

expect_fail() {
  label=$1
  want=$2
  if out=$(run_status); then
    echo "FAIL $label unexpectedly passed out=$out" >&2
    exit 1
  fi
  if [ "$out" != "$want" ]; then
    echo "FAIL $label out=$out" >&2
    exit 1
  fi
  echo "PASS $label"
}

printf '%s\n' "$head_sha" > .deploy-rev
expect_ok marker_matches_head PRODUCTION_TREE_STATUS=clean_except_valid_deploy_marker

printf '%s\n' 0123456789abcdef0123456789abcdef01234567 > .deploy-rev
expect_fail marker_differs_from_head PRODUCTION_TREE_STATUS=invalid_deploy_marker

printf '%s\n' "$head_sha" > .deploy-rev
printf '%s\n' extra >> tracked.txt
expect_fail extra_modified_file PRODUCTION_TREE_STATUS=dirty

git checkout -q -- tracked.txt
printf '%s\n' "$head_sha" > .deploy-rev
printf '%s\n' untracked > extra.txt
expect_fail extra_untracked_file PRODUCTION_TREE_STATUS=dirty

rm -f extra.txt
printf '%s\n' "$head_sha" > .deploy-rev
git add .deploy-rev
expect_fail staged_marker PRODUCTION_TREE_STATUS=dirty

git reset -q HEAD -- .deploy-rev
git checkout -q -- .deploy-rev
expect_ok fully_clean PRODUCTION_TREE_STATUS=clean

echo "TREE_STATUS_TESTS_OK"
