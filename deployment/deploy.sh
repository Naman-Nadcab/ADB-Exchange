#!/usr/bin/env bash
# First production deployment (or full redeploy with build).
#
# Prerequisites:
#   - bash deployment/install.sh (once)
#   - cp .env.production.example .env (all CHANGE_ME filled)
#
# Usage: bash deployment/deploy.sh
# Options:
#   SKIP_TLS=1       Skip TLS certificate generation
#   SKIP_BUILD=1     Use existing images (no rebuild)
#   SKIP_MIGRATE=1   Skip database migrations
#   SKIP_SEED=1      Skip admin user seed
#   SKIP_MONITORING=1 Skip Prometheus/Grafana stack
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=deployment/lib/common.sh
source "${REPO_ROOT}/deployment/lib/common.sh"
cd "$REPO_ROOT"

require_root_or_docker
require_env_file
load_env
validate_production_env

echo "=== Exchange — Production Deploy ==="
echo "Repository: $REPO_ROOT"
echo "Public host: ${PUBLIC_HOST}"

# Sync PUBLIC_* URLs from PUBLIC_HOST if placeholders remain
if [[ "${PUBLIC_API_URL:-}" == *CHANGE_ME* ]]; then
  export PUBLIC_API_URL="https://${PUBLIC_HOST}"
  export PUBLIC_WS_URL="wss://${PUBLIC_HOST}"
  export PUBLIC_ADMIN_URL="https://${PUBLIC_HOST}/admin"
  export FRONTEND_URL="https://${PUBLIC_HOST}"
  export CORS_ORIGINS="https://${PUBLIC_HOST}"
fi

echo "=== Step 1: TLS ==="
if [[ "${SKIP_TLS:-0}" != "1" ]]; then
  if [[ ! -f nginx/ssl/fullchain.pem ]] || [[ ! -f nginx/ssl/privkey.pem ]]; then
    bash deployment/ssl.sh
  else
    log_ok "TLS certificates already present"
  fi
else
  log_warn "SKIP_TLS=1"
fi

echo "=== Step 2: Core infrastructure ==="
"${COMPOSE[@]}" up -d postgres redis rabbitmq nats
for i in $(seq 1 90); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "${POSTGRES_USER:-exchange}" >/dev/null 2>&1 \
    && "${COMPOSE[@]}" exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
    log_ok "Postgres + Redis ready"
    break
  fi
  [[ "$i" -eq 90 ]] && log_fail "Infrastructure not ready"
  sleep 2
done

echo "=== Step 3: Database migrations ==="
if [[ "${SKIP_MIGRATE:-0}" != "1" ]]; then
  bash deployment/lib/migrate.sh
else
  log_warn "SKIP_MIGRATE=1"
fi

echo "=== Step 4: Application stack ==="
if [[ "${SKIP_BUILD:-0}" == "1" ]]; then
  "${COMPOSE[@]}" up -d --remove-orphans
else
  "${COMPOSE[@]}" up -d --build --remove-orphans
fi

wait_backend_live

echo "=== Step 5: Admin seed ==="
if [[ "${SKIP_SEED:-0}" != "1" ]]; then
  bash "${REPO_ROOT}/scripts/vps-seed-admin.sh"
else
  log_warn "SKIP_SEED=1"
fi

echo "=== Step 6: Monitoring stack ==="
if [[ "${SKIP_MONITORING:-0}" != "1" ]]; then
  docker compose -f "$MONITORING_COMPOSE" --env-file "${REPO_ROOT}/.env" up -d
  log_ok "Prometheus + Grafana started (GRAFANA_ADMIN_USER=${GRAFANA_ADMIN_USER:-admin})"
fi

echo "=== Step 7: Health verification ==="
bash deployment/health-check.sh

echo ""
log_ok "Deployment complete"
echo "User app:    $(public_base_url)/"
echo "Admin panel: $(public_base_url)/admin"
echo "Grafana:     http://${PUBLIC_HOST}:3001 (if monitoring enabled)"
