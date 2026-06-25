#!/usr/bin/env bash
# Roll back application images on VPS after a bad deploy (local build workflow).
#
# Usage:
#   bash scripts/vps-rollback.sh              # roll back to saved .deploy-rev.prev
#   bash scripts/vps-rollback.sh <git-ref>      # roll back to explicit commit/tag
#
# Saves current HEAD to .deploy-rev before each successful deploy (call from CI or manually).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.production.yml)
REV_FILE=".deploy-rev"
PREV_FILE=".deploy-rev.prev"
TARGET="${1:-}"

if [ -n "$TARGET" ]; then
  ROLLBACK_REF="$TARGET"
elif [ -f "$PREV_FILE" ]; then
  ROLLBACK_REF="$(tr -d '[:space:]' < "$PREV_FILE")"
else
  echo "Error: no rollback target. Pass a git ref or run vps-save-deploy-rev.sh before deploy." >&2
  exit 1
fi

if ! git rev-parse --verify "${ROLLBACK_REF}^{commit}" >/dev/null 2>&1; then
  echo "Error: invalid git ref: $ROLLBACK_REF" >&2
  exit 1
fi

CURRENT="$(git rev-parse HEAD)"
echo "Rolling back: $CURRENT -> $ROLLBACK_REF"

echo "=== Halt trading ==="
bash scripts/vps-trading-halt.sh halt || true

echo "=== Checkout $ROLLBACK_REF ==="
git stash push -u -m "vps-rollback-$(date +%s)" 2>/dev/null || true
git checkout "$ROLLBACK_REF"

echo "=== Rebuild and restart app services (SKIP_MIGRATE=1) ==="
SKIP_MIGRATE=1 SKIP_SEED=1 bash scripts/vps-first-boot.sh

echo ""
echo "Rollback deploy complete at $(git rev-parse --short HEAD)."
echo "Trading is HALTED — verify health, then: bash scripts/vps-trading-halt.sh resume"
echo "Return to latest: git checkout $CURRENT"
