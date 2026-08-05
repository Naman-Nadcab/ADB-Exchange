#!/usr/bin/env bash
# Roll back to previous deploy revision or explicit git ref.
#
# Usage:
#   bash deployment/rollback.sh              # uses .deploy-rev.prev
#   bash deployment/rollback.sh <git-ref>
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

TARGET="${1:-}"
PREV_FILE=".deploy-rev.prev"

if [[ -n "$TARGET" ]]; then
  ROLLBACK_REF="$TARGET"
elif [[ -f "$PREV_FILE" ]]; then
  ROLLBACK_REF="$(tr -d '[:space:]' < "$PREV_FILE")"
else
  echo "Error: no rollback target. Pass a git ref or run update.sh first." >&2
  exit 1
fi

git rev-parse --verify "${ROLLBACK_REF}^{commit}" >/dev/null 2>&1 || {
  echo "Error: invalid git ref: $ROLLBACK_REF" >&2
  exit 1
}

CURRENT="$(git rev-parse HEAD)"
echo "Rolling back: $CURRENT -> $ROLLBACK_REF"

bash "${REPO_ROOT}/scripts/vps-trading-halt.sh" halt 2>/dev/null || true

git stash push -u -m "rollback-$(date +%s)" 2>/dev/null || true
git checkout "$ROLLBACK_REF"

SKIP_MIGRATE=1 SKIP_SEED=1 bash deployment/deploy.sh

echo ""
echo "Rollback complete at $(git rev-parse --short HEAD)"
echo "Trading may be halted — verify health, then resume via admin or scripts/vps-trading-halt.sh resume"
