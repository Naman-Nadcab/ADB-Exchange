#!/usr/bin/env bash
# Apply updates: save revision, pull, migrate, rebuild, verify.
#
# Usage: bash deployment/update.sh [git-ref]
# Default: git pull on current branch
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=deployment/lib/common.sh
source "${REPO_ROOT}/deployment/lib/common.sh"
cd "$REPO_ROOT"

require_root_or_docker
require_env_file

TARGET="${1:-}"
echo "=== Exchange — Update ==="

# Save current revision for rollback
git rev-parse HEAD > .deploy-rev.prev 2>/dev/null || true
git rev-parse HEAD > .deploy-rev 2>/dev/null || true

if [[ -n "$TARGET" ]]; then
  git fetch --all --tags
  git checkout "$TARGET"
else
  git pull --ff-only
fi

echo "Deploying commit: $(git rev-parse --short HEAD)"

bash deployment/deploy.sh

log_ok "Update complete"
