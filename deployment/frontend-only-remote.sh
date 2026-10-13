#!/bin/sh
# Runs on the production VPS over SSH. Does not print .env values.
# Modes: inspect | deploy | rollback
set -eu

APP=${FE_APP:-/opt/adb-exchange}
MODE=${FE_MODE:-inspect}
EXPECTED=${FE_EXPECTED:-}
RELEASE=${FE_RELEASE:-}
ROLLBACK_FILE=/var/tmp/adb-frontend-step28-rollback.env
BUNDLE=/tmp/frontend-only.bundle
if [ ! -f "$BUNDLE" ] && [ -f /tmp/frontend-only.bundle/frontend-only.bundle ]; then
  BUNDLE=/tmp/frontend-only.bundle/frontend-only.bundle
fi

if [ -z "$APP" ]; then
  APP=/opt/adb-exchange
fi

cd "$APP"
if [ ! -f docker-compose.production.yml ] || [ ! -d apps/frontend ] || [ ! -d .git ]; then
  echo "APP_PATH_INVALID" >&2
  exit 1
fi

stamp() {
  name=$1
  if docker inspect "$name" >/dev/null 2>&1; then
    docker inspect -f "$name status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} started={{.State.StartedAt}} image={{.Image}}" "$name"
  else
    echo "$name MISSING"
  fi
}

record_runtime() {
  stamp exchange-frontend
  stamp exchange-backend
  stamp exchange-postgres
  stamp exchange-redis
  stamp exchange-nats
  stamp exchange-matching-engine
  stamp exchange-admin
  stamp exchange-nginx
  stamp exchange-indexer
  stamp exchange-rabbitmq
}

restore_previous_frontend() {
  if [ ! -f "$ROLLBACK_FILE" ]; then
    echo "ROLLBACK_RECORD_MISSING" >&2
    return 1
  fi
  # shellcheck disable=SC1090
  . "$ROLLBACK_FILE"
  if [ -z "${PREVIOUS_IMAGE_ID:-}" ] || [ -z "${COMPOSE_IMAGE:-}" ]; then
    echo "ROLLBACK_RECORD_INCOMPLETE" >&2
    return 1
  fi
  case "$COMPOSE_IMAGE" in
    sha256:*)
      echo "ROLLBACK_IMAGE_NAME_UNUSABLE" >&2
      return 1
      ;;
  esac
  docker image inspect "$PREVIOUS_IMAGE_ID" >/dev/null
  docker tag "$PREVIOUS_IMAGE_ID" "$COMPOSE_IMAGE"
  docker compose -f docker-compose.production.yml up -d --no-deps --no-build frontend
  echo "FRONTEND_ROLLBACK_ISSUED"
}

wait_frontend() {
  i=0
  while [ "$i" -lt 36 ]; do
    health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' exchange-frontend 2>/dev/null || echo missing)
    status=$(docker inspect -f '{{.State.Status}}' exchange-frontend 2>/dev/null || echo missing)
    if [ "$status" = "running" ] && [ "$health" = "healthy" ]; then
      echo "FRONTEND_HEALTHY"
      return 0
    fi
    i=$((i + 1))
    sleep 5
  done
  echo "FRONTEND_UNHEALTHY status=$status health=$health" >&2
  return 1
}

assert_others_unchanged() {
  before=$1
  after=$(mktemp)
  record_runtime >"$after"
  for name in exchange-backend exchange-postgres exchange-redis exchange-nats exchange-matching-engine exchange-admin exchange-nginx exchange-indexer exchange-rabbitmq; do
    old=$(grep "^$name " "$before" || true)
    new=$(grep "^$name " "$after" || true)
    if [ "$old" != "$new" ]; then
      echo "UNRELATED_CONTAINER_CHANGED $name" >&2
      echo "BEFORE $old" >&2
      echo "AFTER $new" >&2
      rm -f "$after"
      return 1
    fi
  done
  rm -f "$after"
}

classify_production_tree

HEAD=$(git rev-parse HEAD)
echo "PRODUCTION_HEAD=$HEAD"
record_runtime

case "$MODE" in
  inspect)
    echo "INSPECT_ONLY"
    exit 0
    ;;
  rollback)
    restore_previous_frontend
    wait_frontend
    exit 0
    ;;
  deploy) ;;
  *)
    echo "UNKNOWN_MODE" >&2
    exit 1
    ;;
esac

if [ -z "$EXPECTED" ] || [ -z "$RELEASE" ]; then
  echo "SHA_INPUT_MISSING" >&2
  exit 1
fi
if [ "$HEAD" != "$EXPECTED" ]; then
  echo "HEAD_MISMATCH expected=$EXPECTED actual=$HEAD" >&2
  exit 1
fi

require_frontend_build_urls

if [ ! -f "$BUNDLE" ]; then
  echo "BUNDLE_MISSING" >&2
  exit 1
fi
git bundle verify "$BUNDLE" >/dev/null
tip=$(git bundle list-heads "$BUNDLE" | awk 'NR==1 { print $1 }')
if [ -z "$tip" ] || [ "$tip" != "$RELEASE" ]; then
  echo "BUNDLE_TIP_MISMATCH" >&2
  exit 1
fi

before=$(mktemp)
record_runtime >"$before"

old_id=$(docker inspect -f '{{.Image}}' exchange-frontend)
compose_image=$(docker inspect -f '{{.Config.Image}}' exchange-frontend)
case "$compose_image" in
  sha256:*)
    echo "COMPOSE_IMAGE_IS_ID" >&2
    exit 1
    ;;
esac
echo "PREVIOUS_FRONTEND_IMAGE=$old_id"
echo "COMPOSE_IMAGE=$compose_image"
docker tag "$old_id" adb-frontend-step28-previous:local
umask 077
cat >"$ROLLBACK_FILE" <<EOF
PREVIOUS_IMAGE_ID=$old_id
COMPOSE_IMAGE=$compose_image
PREVIOUS_SHA=$HEAD
EOF
chmod 600 "$ROLLBACK_FILE"

git fetch "$BUNDLE" refs/frontend-only/release
git merge --ff-only "$tip"
if [ "$(git rev-parse HEAD)" != "$RELEASE" ]; then
  echo "HEAD_AFTER_MERGE_MISMATCH" >&2
  exit 1
fi
server_files=$(git diff --name-only "$EXPECTED" HEAD)
disallowed=$(printf '%s\n' "$server_files" | grep -v '^apps/frontend/' || true)
if [ -n "$disallowed" ]; then
  echo "SERVER_DIFF_NOT_FRONTEND_ONLY" >&2
  git reset --hard "$EXPECTED"
  exit 1
fi

if ! docker compose -f docker-compose.production.yml up -d --build --no-deps frontend; then
  echo "FRONTEND_UP_FAILED" >&2
  git reset --hard "$EXPECTED"
  restore_previous_frontend || true
  exit 1
fi

if ! wait_frontend; then
  git reset --hard "$EXPECTED"
  restore_previous_frontend || true
  exit 1
fi

if docker exec exchange-frontend sh -c 'grep -R -q api.example.com /app/.next /app/apps 2>/dev/null'; then
  echo "BUILD_CONTAINS_EXAMPLE_API" >&2
  git reset --hard "$EXPECTED"
  restore_previous_frontend || true
  exit 1
fi
echo "example_api_in_build=no"

if ! assert_others_unchanged "$before"; then
  git reset --hard "$EXPECTED"
  restore_previous_frontend || true
  exit 1
fi

echo "DEPLOY_OK"
echo "NEW_FRONTEND_IMAGE=$(docker inspect -f '{{.Image}}' exchange-frontend)"
echo "RELEASE_HEAD=$(git rev-parse HEAD)"
rm -f "$before"
