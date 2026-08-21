#!/usr/bin/env bash
# Backup PostgreSQL to ./backups/
# Usage: bash deployment/backup.sh [output_dir]
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "${REPO_ROOT}/scripts/vps-backup-db.sh" "${1:-./backups}"
