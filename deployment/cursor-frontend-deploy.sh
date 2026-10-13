#!/bin/sh
# Cursor-native frontend-only production deploy.
# Uses the same host-key, tree, preflight, bundle, and remote scripts as
# .github/workflows/deploy-frontend-only.yml. Does not read or print secrets.
#
# Usage:
#   VPS_HOST=... VPS_USER=... VPS_SSH_KEY_PATH=/path/to/key \
#     sh deployment/cursor-frontend-deploy.sh inspect
#   VPS_HOST=... VPS_USER=... VPS_SSH_KEY_PATH=/path/to/key \
#     EXPECTED_SHA=<production-head> RELEASE_SHA=<frontend-commit> \
#     sh deployment/cursor-frontend-deploy.sh deploy
#   VPS_HOST=... VPS_USER=... VPS_SSH_KEY_PATH=/path/to/key \
#     sh deployment/cursor-frontend-deploy.sh rollback
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
MODE=${1:-}
HOST=${VPS_HOST:-}
USER_NAME=${VPS_USER:-}
KEY_PATH=${VPS_SSH_KEY_PATH:-}
APP=${VPS_APP:-/opt/adb-exchange}
EXPECTED=${EXPECTED_SHA:-}
RELEASE=${RELEASE_SHA:-}
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

die() {
  echo "$1" >&2
  exit 1
}

case "$MODE" in
  inspect|deploy|rollback) ;;
  *) die "UNKNOWN_MODE" ;;
esac

case "$HOST" in
  ''|*[!A-Za-z0-9._-]*) die "VPS_HOST_UNSAFE" ;;
esac
case "$USER_NAME" in
  ''|*[!A-Za-z0-9._-]*) die "VPS_USER_UNSAFE" ;;
esac
case "$APP" in
  ''|*[!A-Za-z0-9/_.-]*) die "APP_PATH_UNSAFE" ;;
esac

if [ -z "$KEY_PATH" ] || [ ! -f "$KEY_PATH" ] || [ -L "$KEY_PATH" ]; then
  die "SSH_KEY_MISSING"
fi
perm=$(stat -c '%a' "$KEY_PATH")
case "$perm" in
  600|400) ;;
  *) die "SSH_KEY_PERMISSIONS" ;;
esac
if ! ssh-keygen -lf "$KEY_PATH" >/dev/null 2>&1; then
  die "DEPLOY_KEY_UNREADABLE"
fi

cd "$ROOT"
sh "$ROOT/deployment/frontend-only-hostkey.sh" "$HOST" "$WORK/known_hosts"

remote_sh() {
  # Arguments are the remote command words. Script bytes are on stdin.
  # Use a function so the key path is not echoed by set -x (set -x is never enabled).
  ssh \
    -i "$KEY_PATH" \
    -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=yes \
    -o UserKnownHostsFile="$WORK/known_hosts" \
    -o GlobalKnownHostsFile=/dev/null \
    -o HostKeyAlgorithms=ssh-ed25519 \
    -o BatchMode=yes \
    -o ConnectTimeout=20 \
    "$USER_NAME@$HOST" \
    "$@"
}

inspect_production() {
  remote_sh "APP=$(printf '%q' "$APP") sh -s" <<INSPECT_PAYLOAD
set -eu
cd "\$APP"
if [ ! -f docker-compose.production.yml ] || [ ! -d apps/frontend ] || [ ! -d .git ]; then
  echo "APP_PATH_INVALID" >&2
  exit 1
fi
echo "PRODUCTION_HOSTNAME=\$(hostname)"
echo "PRODUCTION_HEAD=\$(git rev-parse HEAD)"
FRONTEND_ONLY_TREE_LIBRARY=1
$(cat "$ROOT/deployment/frontend-only-tree-status.sh")
classify_production_tree
for name in exchange-frontend exchange-backend exchange-postgres exchange-redis exchange-nats exchange-matching-engine exchange-admin exchange-nginx exchange-indexer exchange-rabbitmq; do
  if docker inspect "\$name" >/dev/null 2>&1; then
    docker inspect -f "\$name status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} started={{.State.StartedAt}} image={{.Image}}" "\$name"
  else
    echo "\$name MISSING"
  fi
done
echo "INSPECT_ONLY"
INSPECT_PAYLOAD
}

field() {
  printf '%s\n' "$1" | awk -v key="$2" 'index($0, key"=") == 1 { print substr($0, length(key) + 2); exit }'
}

smoke() {
  curl -fsSI --max-time 20 "https://$HOST/login" >/dev/null
  curl -fsSI --max-time 20 "https://$HOST/forex/account" >/dev/null
  curl -fsS --max-time 20 "https://$HOST/health" | grep -q '"status":"healthy"'
  echo "public_smoke=ok"
}

run_remote_mode() {
  mode=$1
  remote_sh "FE_MODE=$(printf '%q' "$mode") FE_APP=$(printf '%q' "$APP") FE_EXPECTED=$(printf '%q' "$EXPECTED") FE_RELEASE=$(printf '%q' "$RELEASE") sh -s" <<FE_REMOTE
FRONTEND_ONLY_TREE_LIBRARY=1
$(cat "$ROOT/deployment/frontend-only-tree-status.sh")
$(cat "$ROOT/deployment/frontend-only-remote.sh")
FE_REMOTE
}

if [ "$MODE" = "inspect" ]; then
  echo "CURSOR_DEPLOY_MODE=inspect"
  inspect_production
  exit 0
fi

if [ "$MODE" = "rollback" ]; then
  echo "CURSOR_DEPLOY_MODE=rollback"
  run_remote_mode rollback
  exit 0
fi

case "$EXPECTED" in
  ''|*[!0-9a-fA-F]*) die "expected_production_sha is not a commit SHA" ;;
esac
case "$RELEASE" in
  ''|*[!0-9a-fA-F]*) die "release_sha is not a commit SHA" ;;
esac

echo "CURSOR_DEPLOY_MODE=deploy"
sh "$ROOT/deployment/frontend-only-preflight.sh" "$EXPECTED" "$RELEASE"
EXPECTED=$(git rev-parse "${EXPECTED}^{commit}")
RELEASE=$(git rev-parse "${RELEASE}^{commit}")

echo "CURSOR_PREDEPLOY_INSPECT"
before=$(inspect_production)
printf '%s\n' "$before"
live_head=$(field "$before" PRODUCTION_HEAD)
live_tree=$(field "$before" PRODUCTION_TREE_STATUS)
if [ "$live_head" != "$EXPECTED" ]; then
  echo "PRODUCTION_HEAD_MISMATCH expected=$EXPECTED actual=$live_head" >&2
  die "DEPLOY_STOPPED"
fi
case "$live_tree" in
  clean|clean_except_valid_deploy_marker) ;;
  *) echo "PRODUCTION_TREE_REJECTED status=$live_tree" >&2; die "DEPLOY_STOPPED" ;;
esac

git bundle create "$WORK/frontend-only.bundle" "$RELEASE" ^"$EXPECTED"
git bundle verify "$WORK/frontend-only.bundle" >/dev/null
tip=$(git bundle list-heads "$WORK/frontend-only.bundle" | awk 'NR==1 { print $1 }')
if [ "$tip" != "$RELEASE" ]; then
  die "BUNDLE_TIP_MISMATCH"
fi

scp \
  -i "$KEY_PATH" \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$WORK/known_hosts" \
  -o GlobalKnownHostsFile=/dev/null \
  -o HostKeyAlgorithms=ssh-ed25519 \
  -o BatchMode=yes \
  -o ConnectTimeout=20 \
  "$WORK/frontend-only.bundle" \
  "$USER_NAME@$HOST:/tmp/frontend-only.bundle"

set +e
deploy_out=$(run_remote_mode deploy 2>&1)
deploy_code=$?
set -e
printf '%s\n' "$deploy_out"
if [ "$deploy_code" -ne 0 ]; then
  die "DEPLOY_FAILED"
fi
if ! printf '%s\n' "$deploy_out" | grep -q '^DEPLOY_OK$'; then
  die "DEPLOY_FAILED"
fi

if ! smoke; then
  echo "SMOKE_FAILED" >&2
  run_remote_mode rollback || die "SMOKE_FAILED_ROLLBACK_FAILED"
  die "SMOKE_FAILED_ROLLED_BACK"
fi

echo "CURSOR_POSTDEPLOY_INSPECT"
after=$(inspect_production)
printf '%s\n' "$after"
for name in exchange-backend exchange-postgres exchange-redis exchange-nats exchange-matching-engine exchange-admin exchange-nginx exchange-indexer exchange-rabbitmq; do
  old=$(printf '%s\n' "$before" | awk -v n="$name" 'index($0, n" ") == 1 { print; exit }')
  new=$(printf '%s\n' "$after" | awk -v n="$name" 'index($0, n" ") == 1 { print; exit }')
  if [ "$old" != "$new" ]; then
    echo "UNRELATED_CONTAINER_CHANGED $name" >&2
    run_remote_mode rollback || die "UNRELATED_CHANGE_ROLLBACK_FAILED"
    die "UNRELATED_CONTAINER_CHANGED"
  fi
done

echo "CURSOR_DEPLOY_OK"
echo "RELEASE_HEAD=$RELEASE"
echo "PREVIOUS_PRODUCTION_HEAD=$EXPECTED"
