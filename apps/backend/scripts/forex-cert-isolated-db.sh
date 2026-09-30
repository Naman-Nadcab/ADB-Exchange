#!/usr/bin/env bash
# Isolated Forex certification DB — does NOT migrate the live `exchange` database.
set -euo pipefail
CERT_DB="${FOREX_CERT_DATABASE_NAME:-exchange_forex_cert}"
PGHOST="${FOREX_CERT_PGHOST:-127.0.0.1}"
PGPORT="${FOREX_CERT_PGPORT:-5432}"
PGUSER="${FOREX_CERT_PGUSER:-exchange}"

if [[ -z "${FOREX_CERT_DATABASE_URL:-}" && -z "${FOREX_CERT_PGPASSWORD:-}" ]]; then
  echo "Set FOREX_CERT_DATABASE_URL or FOREX_CERT_PGPASSWORD (and user/host) for cert DB bootstrap."
  exit 1
fi

export PGPASSWORD="${FOREX_CERT_PGPASSWORD:-}"
PSQL=(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -v ON_ERROR_STOP=1)

if [[ -n "${FOREX_CERT_DATABASE_URL:-}" ]]; then
  "${PSQL[@]}" "$FOREX_CERT_DATABASE_URL" -c "SELECT current_database() AS db, 'cert-ready' AS status;"
  exit 0
fi

"${PSQL[@]}" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '${CERT_DB}'" | grep -q 1 \
  || "${PSQL[@]}" -d postgres -c "CREATE DATABASE ${CERT_DB};"

DATABASE_URL="postgresql://${PGUSER}:${FOREX_CERT_PGPASSWORD}@${PGHOST}:${PGPORT}/${CERT_DB}?sslmode=disable" \
  npm run migrate --prefix "$(dirname "$0")/.."

echo "ENVIRONMENT=LOCAL_ISOLATED_CERT DB=${CERT_DB} HOST=${PGHOST}:${PGPORT}"
