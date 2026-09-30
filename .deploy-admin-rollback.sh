#!/usr/bin/env bash
# Roll back admin-panel to pre–Forex ops UI deploy (2026-09-16).
set -euo pipefail
cd "$(dirname "$0")"
ROLLBACK_TAG="${1:-$(cat .deploy-admin-rollback-tag 2>/dev/null || echo m-live-admin-panel:rollback-20260916T124404Z)}"
echo "Rolling back to $ROLLBACK_TAG"
docker tag "$ROLLBACK_TAG" m-live-admin-panel:latest
docker compose -f docker-compose.production.yml up -d --no-deps --force-recreate admin-panel
echo "Wait for health: docker inspect exchange-admin --format '{{.State.Health.Status}}'"
