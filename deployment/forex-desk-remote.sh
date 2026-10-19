#!/bin/sh
# Runs on the production VPS over SSH. Does not print .env values.
# Modes: deploy | rollback
# Records a backup point, applies the compiled migration one-shot, then
# rebuilds only the backend and admin images.
# It does not run production.yml or restart the customer frontend.
set -eu

APP=${DESK_APP:-/opt/adb-exchange}
MODE=${DESK_MODE:-}
EXPECTED=${DESK_EXPECTED:-}
RELEASE=${DESK_RELEASE:-}
BUNDLE=${DESK_BUNDLE:-/tmp/forex-desk.bundle}
ROLLBACK_FILE=/var/tmp/adb-forex-desk-rollback.env

if [ -z "$APP" ]; then
  APP=/opt/adb-exchange
fi

cd "$APP"
if [ ! -f docker-compose.production.yml ] || [ ! -d apps/backend ] || [ ! -d apps/admin-panel ] || [ ! -d .git ]; then
  echo "APP_PATH_INVALID" >&2
  exit 1
fi

MERGED=0
REPLACED_BACKEND=0
REPLACED_ADMIN=0

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

wait_healthy() {
  name=$1
  i=0
  status=missing
  health=missing
  while [ "$i" -lt 90 ]; do
    status=$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null || echo missing)
    health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$name" 2>/dev/null || echo missing)
    if [ "$status" = "running" ] && [ "$health" = "healthy" ]; then
      echo "$name HEALTHY"
      return 0
    fi
    i=$((i + 1))
    sleep 5
  done
  echo "$name UNHEALTHY status=$status health=$health" >&2
  return 1
}

restore_images() {
  if [ ! -f "$ROLLBACK_FILE" ]; then
    echo "ROLLBACK_RECORD_MISSING" >&2
    return 1
  fi
  # shellcheck disable=SC1090
  . "$ROLLBACK_FILE"
  if [ -z "${PREVIOUS_BACKEND_IMAGE_ID:-}" ] || [ -z "${BACKEND_COMPOSE_IMAGE:-}" ] || [ -z "${PREVIOUS_ADMIN_IMAGE_ID:-}" ] || [ -z "${ADMIN_COMPOSE_IMAGE:-}" ] || [ -z "${PREVIOUS_SHA:-}" ]; then
    echo "ROLLBACK_RECORD_INCOMPLETE" >&2
    return 1
  fi
  case "$BACKEND_COMPOSE_IMAGE" in
    sha256:*) echo "ROLLBACK_IMAGE_NAME_UNUSABLE" >&2; return 1 ;;
  esac
  case "$ADMIN_COMPOSE_IMAGE" in
    sha256:*) echo "ROLLBACK_IMAGE_NAME_UNUSABLE" >&2; return 1 ;;
  esac
  docker image inspect "$PREVIOUS_ADMIN_IMAGE_ID" >/dev/null
  scope=${RESTORE_SCOPE:-both}
  if [ "$scope" != "admin" ]; then
    docker image inspect "$PREVIOUS_BACKEND_IMAGE_ID" >/dev/null
    docker tag "$PREVIOUS_BACKEND_IMAGE_ID" "$BACKEND_COMPOSE_IMAGE"
    docker compose -f docker-compose.production.yml up -d --no-deps --no-build backend
    wait_healthy exchange-backend
  fi
  docker tag "$PREVIOUS_ADMIN_IMAGE_ID" "$ADMIN_COMPOSE_IMAGE"
  docker compose -f docker-compose.production.yml up -d --no-deps --no-build admin-panel
  wait_healthy exchange-admin
  if [ -n "${PREVIOUS_SHA:-}" ]; then
    git reset --hard "$PREVIOUS_SHA"
  fi
  echo "DESK_ROLLBACK_ISSUED"
}

fail() {
  echo "$1" >&2
  if [ "$REPLACED_BACKEND" = 1 ] || [ "$REPLACED_ADMIN" = 1 ]; then
    restore_images || true
  elif [ "$MERGED" = 1 ] && [ -n "$EXPECTED" ]; then
    git reset --hard "$EXPECTED"
  fi
  exit 1
}

assert_others_unchanged() {
  before=$1
  after=$(mktemp)
  record_runtime >"$after"
  names="exchange-frontend exchange-postgres exchange-redis exchange-nats exchange-matching-engine exchange-nginx exchange-indexer exchange-rabbitmq"
  if [ "$MODE" = "admin" ]; then
    names="$names exchange-backend"
  fi
  for name in $names; do
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

env_get() {
  key=$1
  line=$(grep -E "^${key}=" .env | tail -1 || true)
  printf '%s' "${line#*=}" | tr -d '\r'
}

HEAD=$(git rev-parse HEAD)
echo "PRODUCTION_HEAD=$HEAD"
record_runtime

case "$MODE" in
  rollback)
    restore_images
    wait_healthy exchange-backend
    wait_healthy exchange-admin
    exit 0
    ;;
  deploy|admin) ;;
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
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "DIRTY_TREE" >&2
  exit 1
fi

avail=$(df -Pk "$APP" | awk 'NR==2 { print $4 }')
echo "DISK_FREE_KB=$avail"
if [ -z "$avail" ] || [ "$avail" -lt 6291456 ]; then
  echo "LOW_DISK" >&2
  exit 1
fi

api_line=$(grep -E '^PUBLIC_API_URL=' .env | tail -1 || true)
case "$api_line" in
  PUBLIC_API_URL=http://*|PUBLIC_API_URL=https://*) ;;
  *)
    echo "PUBLIC_API_URL_MISSING" >&2
    exit 1
    ;;
esac

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

ts=$(date -u +%Y%m%dT%H%M%SZ)
old_backend=$(docker inspect -f '{{.Image}}' exchange-backend)
backend_name=$(docker inspect -f '{{.Config.Image}}' exchange-backend)
old_admin=$(docker inspect -f '{{.Image}}' exchange-admin)
admin_name=$(docker inspect -f '{{.Config.Image}}' exchange-admin)
case "$backend_name" in
  sha256:*) echo "COMPOSE_IMAGE_IS_ID" >&2; exit 1 ;;
esac
case "$admin_name" in
  sha256:*) echo "COMPOSE_IMAGE_IS_ID" >&2; exit 1 ;;
esac
echo "PREVIOUS_BACKEND_IMAGE=$old_backend"
echo "PREVIOUS_ADMIN_IMAGE=$old_admin"
echo "BACKEND_CREATED=$(docker inspect -f '{{.Created}}' exchange-backend)"
echo "ADMIN_CREATED=$(docker inspect -f '{{.Created}}' exchange-admin)"
docker tag "$old_backend" "adb-exchange-backend:backup-$ts"
docker tag "$old_admin" "adb-exchange-admin:backup-$ts"

mkdir -p "$APP/backups"
db_file=none
restore_scope=both
if [ "$MODE" = "admin" ]; then
  restore_scope=admin
  echo "BACKUP_DB=skipped"
else
  PG_USER=$(env_get POSTGRES_USER)
  PG_DB=$(env_get POSTGRES_DB)
  PG_USER=${PG_USER:-exchange}
  PG_DB=${PG_DB:-exchange}
  db_file="$APP/backups/exchange_db_${ts}.sql.gz"
  if ! docker exec exchange-postgres pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
    echo "POSTGRES_NOT_READY" >&2
    exit 1
  fi
  docker exec exchange-postgres pg_dump -U "$PG_USER" -d "$PG_DB" --no-owner --no-acl | gzip > "$db_file"
  gzip -t "$db_file"
  db_bytes=$(wc -c < "$db_file" | tr -d ' ')
  if [ -z "$db_bytes" ] || [ "$db_bytes" -lt 1000 ]; then
    echo "BACKUP_DB_TOO_SMALL" >&2
    exit 1
  fi
  echo "BACKUP_DB=$db_file"
  echo "BACKUP_DB_BYTES=$db_bytes"
fi

umask 077
cat >"$ROLLBACK_FILE" <<EOF
PREVIOUS_BACKEND_IMAGE_ID=$old_backend
BACKEND_COMPOSE_IMAGE=$backend_name
PREVIOUS_ADMIN_IMAGE_ID=$old_admin
ADMIN_COMPOSE_IMAGE=$admin_name
PREVIOUS_SHA=$HEAD
BACKUP_TS=$ts
BACKUP_DB=$db_file
RESTORE_SCOPE=$restore_scope
EOF
chmod 600 "$ROLLBACK_FILE"
cp "$ROLLBACK_FILE" "$APP/backups/forex-desk-rollback-$ts.env"
chmod 600 "$APP/backups/forex-desk-rollback-$ts.env"
echo "BACKUP_POINT_TS=$ts"
echo "BACKUP_BACKEND_TAG=adb-exchange-backend:backup-$ts"
echo "BACKUP_ADMIN_TAG=adb-exchange-admin:backup-$ts"
echo "BACKUP_GIT=$HEAD"
echo "BACKUP_RECORDED"

before=$(mktemp)
record_runtime >"$before"

git fetch "$BUNDLE" refs/forex-desk/release
git merge --ff-only "$tip"
MERGED=1
if [ "$(git rev-parse HEAD)" != "$RELEASE" ]; then
  fail "HEAD_AFTER_MERGE_MISMATCH"
fi
server_files=$(git diff --name-only "$EXPECTED" HEAD)
if [ "$MODE" = "admin" ]; then
  disallowed=$(printf '%s\n' "$server_files" | grep -v -e '^apps/admin-panel/' -e '^\.github/workflows/deploy-forex-desk.yml$' -e '^deployment/forex-desk-remote.sh$' || true)
else
  disallowed=$(printf '%s\n' "$server_files" | grep -v -e '^apps/backend/' -e '^apps/admin-panel/' -e '^\.github/workflows/deploy-forex-desk.yml$' -e '^deployment/forex-desk-remote.sh$' || true)
fi
if [ -n "$disallowed" ]; then
  echo "SERVER_DIFF_NOT_DESK_ONLY" >&2
  printf '%s\n' "$disallowed" | head -40 >&2
  fail "SERVER_DIFF_NOT_DESK_ONLY"
fi
if [ -z "$server_files" ]; then
  fail "EMPTY_DIFF"
fi

if [ "$MODE" != "admin" ]; then
  docker rm -f exchange-migrate >/dev/null 2>&1 || true
  echo "MIGRATE_START"
  if ! docker compose -f docker-compose.production.yml --profile tools run --rm --no-deps --build migrate; then
    fail "MIGRATE_FAILED"
  fi
  echo "MIGRATE_OK"
fi

if [ "$MODE" != "admin" ]; then
  if ! docker compose -f docker-compose.production.yml up -d --build --no-deps backend; then
    now_backend=$(docker inspect -f '{{.Image}}' exchange-backend)
    if [ "$now_backend" != "$old_backend" ]; then
      REPLACED_BACKEND=1
    fi
    fail "BACKEND_UP_FAILED"
  fi
  REPLACED_BACKEND=1
  if ! wait_healthy exchange-backend; then
    fail "BACKEND_UNHEALTHY"
  fi
fi

if ! docker compose -f docker-compose.production.yml up -d --build --no-deps admin-panel; then
  now_admin=$(docker inspect -f '{{.Image}}' exchange-admin)
  if [ "$now_admin" != "$old_admin" ]; then
    REPLACED_ADMIN=1
  fi
  fail "ADMIN_UP_FAILED"
fi
REPLACED_ADMIN=1
if ! wait_healthy exchange-admin; then
  fail "ADMIN_UNHEALTHY"
fi

if ! assert_others_unchanged "$before"; then
  fail "UNRELATED_CONTAINER_CHANGED"
fi

echo "DEPLOY_OK"
echo "NEW_BACKEND_IMAGE=$(docker inspect -f '{{.Image}}' exchange-backend)"
echo "NEW_ADMIN_IMAGE=$(docker inspect -f '{{.Image}}' exchange-admin)"
echo "RELEASE_HEAD=$(git rev-parse HEAD)"
rm -f "$before"
