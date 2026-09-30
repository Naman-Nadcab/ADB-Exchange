#!/usr/bin/env bash
# Restore Docker images from backup point 20260916T210450Z (no DB restore).
set -euo pipefail
cd "$(dirname "$0")"
TS="${BACKUP_TS:-20260916T210450Z}"
SCOPE="${1:-all}"

restore() {
  local svc="$1" img="$2"
  echo "Restore $svc -> $img"
  docker tag "$img" "m-live-${svc}:latest"
}

case "$SCOPE" in
  frontend)
    restore frontend "m-live-frontend:backup-${TS}"
    docker compose -f docker-compose.production.yml up -d --no-deps --force-recreate frontend
    ;;
  admin|admin-panel)
    restore admin-panel "m-live-admin-panel:backup-${TS}"
    docker compose -f docker-compose.production.yml up -d --no-deps --force-recreate admin-panel
    ;;
  backend)
    restore backend "m-live-backend:backup-${TS}"
    docker compose -f docker-compose.production.yml up -d --no-deps --force-recreate backend
    ;;
  all)
    restore backend "m-live-backend:backup-${TS}"
    restore admin-panel "m-live-admin-panel:backup-${TS}"
    restore frontend "m-live-frontend:backup-${TS}"
    docker compose -f docker-compose.production.yml up -d --no-deps --force-recreate backend
    for i in $(seq 1 60); do
      st=$(docker inspect exchange-backend --format '{{.State.Health.Status}}' 2>/dev/null || echo starting)
      [ "$st" = "healthy" ] && break
      sleep 3
    done
    docker compose -f docker-compose.production.yml up -d --no-deps --force-recreate admin-panel frontend
    ;;
  *)
    echo "Usage: $0 [all|frontend|admin|backend]" >&2
    exit 1
    ;;
esac

echo "Done. Check: docker ps && curl -sf http://127.0.0.1/health/live"
