#!/usr/bin/env bash
# Record current git commit before deploy for vps-rollback.sh.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REV="$(git rev-parse HEAD)"
if [ -f .deploy-rev ]; then
  cp .deploy-rev .deploy-rev.prev
fi
echo "$REV" > .deploy-rev
echo "Saved deploy revision: $REV"
if [ -f .deploy-rev.prev ]; then
  echo "Previous (rollback target): $(tr -d '[:space:]' < .deploy-rev.prev)"
fi
