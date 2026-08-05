#!/usr/bin/env bash
# Shared helpers for deployment scripts.
set -euo pipefail

deployment_root() {
  cd "$(dirname "${BASH_SOURCE[1]}")/.." && pwd
}

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
COMPOSE_FILE="${REPO_ROOT}/docker-compose.production.yml"
MONITORING_COMPOSE="${REPO_ROOT}/infra/docker-compose.monitoring.yml"
COMPOSE=(docker compose -f "$COMPOSE_FILE")

log_ok()   { echo "[OK]   $*"; }
log_warn() { echo "[WARN] $*" >&2; }
log_fail() { echo "[FAIL] $*" >&2; exit 1; }

require_root_or_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    log_fail "Docker is not installed. Run: bash deployment/install.sh"
  fi
  if ! docker compose version >/dev/null 2>&1; then
    log_fail "Docker Compose plugin not found. Run: bash deployment/install.sh"
  fi
}

require_env_file() {
  if [[ ! -f "${REPO_ROOT}/.env" ]]; then
    log_fail "Missing ${REPO_ROOT}/.env — copy .env.production.example and fill all CHANGE_ME values"
  fi
}

detect_docker_gid() {
  if [[ -n "${DOCKER_GID:-}" ]]; then
    return 0
  fi
  local gid=""
  gid="$(getent group docker 2>/dev/null | cut -d: -f3 || true)"
  if [[ -n "$gid" ]]; then
    export DOCKER_GID="$gid"
    log_ok "Auto-detected DOCKER_GID=${DOCKER_GID}"
  else
    export DOCKER_GID=999
    log_warn "docker group not found — using DOCKER_GID=999 (set DOCKER_GID in .env to override)"
  fi
}

load_env() {
  set -a
  # shellcheck disable=SC1091
  source "${REPO_ROOT}/.env"
  set +a
  detect_docker_gid
  export DOCKER_GID
}

validate_production_env() {
  local required=(
    POSTGRES_PASSWORD RABBITMQ_PASSWORD
    JWT_SECRET JWT_REFRESH_SECRET ENCRYPTION_KEY
    SESSION_SECRET CSRF_SECRET
    ENGINE_HMAC_SECRET ENGINE_INTERNAL_SECRET
    INTERNAL_HMAC_SERVICE_SECRETS INTERNAL_API_ALLOW_CIDRS
    ADMIN_IP_WHITELIST PUBLIC_HOST
    AWS_KMS_KEY_ID AWS_REGION
    INITIAL_ADMIN_EMAIL INITIAL_ADMIN_PASSWORD
    GRAFANA_ADMIN_PASSWORD
  )
  local v val
  for v in "${required[@]}"; do
    val="${!v:-}"
    if [[ -z "$val" ]] || [[ "$val" == CHANGE_ME* ]]; then
      log_fail "$v is unset or still a placeholder in .env"
    fi
  done
  if [[ "${#INITIAL_ADMIN_PASSWORD}" -lt 8 ]]; then
    log_fail "INITIAL_ADMIN_PASSWORD must be at least 8 characters"
  fi
}

wait_postgres() {
  local user="${POSTGRES_USER:-exchange}"
  local db="${POSTGRES_DB:-exchange}"
  local i
  for i in $(seq 1 90); do
    if "${COMPOSE[@]}" exec -T postgres pg_isready -U "$user" -d "$db" >/dev/null 2>&1; then
      log_ok "PostgreSQL ready"
      return 0
    fi
    sleep 2
  done
  log_fail "PostgreSQL did not become ready"
}

wait_backend_live() {
  local i
  for i in $(seq 1 120); do
    if "${COMPOSE[@]}" exec -T backend wget -q -O /dev/null http://127.0.0.1:4000/health/live 2>/dev/null; then
      log_ok "Backend liveness OK"
      return 0
    fi
    sleep 3
  done
  log_fail "Backend did not become healthy"
}

public_base_url() {
  if [[ -f "${REPO_ROOT}/nginx/ssl/fullchain.pem" ]]; then
    echo "https://${PUBLIC_HOST:-127.0.0.1}"
  else
    echo "http://${PUBLIC_HOST:-127.0.0.1}"
  fi
}
