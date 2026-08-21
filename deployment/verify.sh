#!/usr/bin/env bash
# Full release verification (health + infrastructure smoke).
# Usage: bash deployment/verify.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=deployment/lib/common.sh
source "${REPO_ROOT}/deployment/lib/common.sh"
cd "$REPO_ROOT"

require_root_or_docker
require_env_file
load_env

echo "=== Release Verification ==="

bash deployment/health-check.sh

echo "=== Container status ==="
docker compose -f "$COMPOSE_FILE" ps

echo "=== Deep health (via backend port if exposed) ==="
if curl -sf --max-time 30 "http://127.0.0.1:4000/health/deep" 2>/dev/null | head -c 500; then
  echo ""
  log_ok "Deep health reachable"
else
  log_warn "Deep health not reachable on localhost:4000 (may be docker-internal only)"
fi

echo "=== Prometheus targets ==="
if curl -sf http://127.0.0.1:9090/api/v1/targets 2>/dev/null | grep -q '"health":"up"'; then
  log_ok "Prometheus scraping backend"
else
  log_warn "Prometheus target not up — ensure monitoring stack is on exchange-production network"
fi

log_ok "Verification complete"
