#!/usr/bin/env bash
# Scheduled PostgreSQL backup for the production VPS.
# Writes only to /opt/m-live/backups — never touches /opt/m-live/release-backup.
# Optional encryption: set BACKUP_ENCRYPTION_KEY in the environment (openssl AES-256-CBC).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="${BACKUP_OUTPUT_DIR:-$ROOT/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
LOG_DIR="$ROOT/backups"
mkdir -p "$OUTPUT_DIR" "$LOG_DIR"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

log "Starting PostgreSQL backup into $OUTPUT_DIR"
bash "$ROOT/scripts/vps-backup-db.sh" "$OUTPUT_DIR"

latest="$(ls -1t "$OUTPUT_DIR"/exchange_db_*.sql.gz 2>/dev/null | head -1 || true)"
if [ -z "$latest" ]; then
  log "ERROR: no gzip backup found after dump"
  exit 1
fi

if ! gzip -t "$latest"; then
  log "ERROR: gzip integrity check failed: $latest"
  exit 1
fi
log "Verified gzip: $latest ($(du -h "$latest" | cut -f1))"

if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  enc="${latest}.enc"
  openssl enc -aes-256-cbc -pbkdf2 -salt -in "$latest" -out "$enc" -pass env:BACKUP_ENCRYPTION_KEY
  log "Encrypted copy written: $enc"
fi

find "$OUTPUT_DIR" -maxdepth 1 -name 'exchange_db_*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete
find "$OUTPUT_DIR" -maxdepth 1 -name 'exchange_db_*.sql.gz.enc' -mtime "+${RETENTION_DAYS}" -delete
log "Retention applied (${RETENTION_DAYS} days). Off-server copy is not configured."
