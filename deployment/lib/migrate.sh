#!/usr/bin/env bash
# Run database migrations via Docker tools profile.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=deployment/lib/common.sh
source "${REPO_ROOT}/deployment/lib/common.sh"
cd "$REPO_ROOT"
require_root_or_docker
require_env_file
"${COMPOSE[@]}" up -d postgres
wait_postgres
echo "=== Running migrations ==="
"${COMPOSE[@]}" --profile tools run --rm migrate
log_ok "Migrations complete"
