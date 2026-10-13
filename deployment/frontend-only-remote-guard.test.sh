#!/bin/sh
# The production remote script must stop before any compose mutation when the
# tree or the live HEAD is not acceptable. Docker is a local stub.
set -eu

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

repo=$work/repo
mkdir -p "$repo" "$work/bin"
cd "$repo"
git init -q
git config user.email guard@example.com
git config user.name guard
mkdir -p apps/frontend
printf '%s\n' services: > docker-compose.production.yml
printf '%s\n' ui > apps/frontend/app.txt
git add docker-compose.production.yml apps/frontend/app.txt
git commit -q -m base
head_sha=$(git rev-parse HEAD)
other=0123456789abcdef0123456789abcdef01234567

cat > "$work/bin/docker" <<'EOF'
#!/bin/sh
printf '%s\n' "$*" >> "${DOCKER_LOG:?}"
exit 0
EOF
chmod +x "$work/bin/docker"

payload=$work/payload.sh
{
  echo 'FRONTEND_ONLY_TREE_LIBRARY=1'
  cat "$root/deployment/frontend-only-tree-status.sh"
  cat "$root/deployment/frontend-only-remote.sh"
} > "$payload"

run_remote() {
  set +e
  out=$(
    env \
      PATH="$work/bin:$PATH" \
      DOCKER_LOG="$work/docker.log" \
      FE_APP="$repo" \
      FE_MODE=deploy \
      FE_EXPECTED="$1" \
      FE_RELEASE="$2" \
      sh "$payload" 2>&1
  )
  code=$?
  set -e
  printf '%s\n' "$out"
  return "$code"
}

expect_stop() {
  label=$1
  want=$2
  expected=$3
  release=$4
  : > "$work/docker.log"
  before=$(git rev-parse HEAD)
  if out=$(run_remote "$expected" "$release"); then
    echo "FAIL $label unexpectedly passed" >&2
    printf '%s\n' "$out" >&2
    exit 1
  fi
  if ! printf '%s\n' "$out" | grep -q "$want"; then
    echo "FAIL $label missing $want" >&2
    printf '%s\n' "$out" >&2
    exit 1
  fi
  if grep -Eq 'compose|build| up' "$work/docker.log"; then
    echo "FAIL $label mutated docker" >&2
    cat "$work/docker.log" >&2
    exit 1
  fi
  after=$(git rev-parse HEAD)
  if [ "$before" != "$after" ]; then
    echo "FAIL $label changed HEAD" >&2
    exit 1
  fi
  echo "PASS $label"
}

expect_stop production_baseline_mismatch HEAD_MISMATCH "$other" "$head_sha"

printf '%s\n' "$head_sha" > .deploy-rev
git add .deploy-rev
git commit -q -m marker
head_sha=$(git rev-parse HEAD)
printf '%s\n' "$other" > .deploy-rev
expect_stop invalid_deploy_marker PRODUCTION_TREE_STATUS=invalid_deploy_marker "$head_sha" "$head_sha"
git checkout -q -- .deploy-rev

printf '%s\n' extra >> apps/frontend/app.txt
expect_stop extra_modified_file PRODUCTION_TREE_STATUS=dirty "$head_sha" "$head_sha"
git checkout -q -- apps/frontend/app.txt

printf '%s\n' stray > stray.txt
expect_stop extra_untracked_file PRODUCTION_TREE_STATUS=dirty "$head_sha" "$head_sha"
rm -f stray.txt

if [ -s "$work/docker.log" ]; then
  echo "FAIL dirty tree reached docker" >&2
  exit 1
fi

echo "REMOTE_GUARD_TESTS_OK"
