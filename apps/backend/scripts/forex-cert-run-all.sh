#!/usr/bin/env bash
# Orchestrates Forex Admin Tier-1 runtime certification (cert DB + cert API only).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
BACKEND="$ROOT/apps/backend"
CERT_URL="$(node -e "require('dotenv').config({path:'$ROOT/.env'});const u=process.env.POSTGRES_USER||'exchange';const p=encodeURIComponent(process.env.POSTGRES_PASSWORD||'');process.stdout.write('postgresql://'+u+':'+p+'@127.0.0.1:5432/exchange_forex_cert?sslmode=disable')")"
JWT_SECRET="$(node -e "require('dotenv').config({path:'$ROOT/.env'});process.stdout.write(process.env.JWT_SECRET||'')")"
JWT_REFRESH="$(node -e "require('dotenv').config({path:'$ROOT/.env'});process.stdout.write(process.env.JWT_REFRESH_SECRET||'')")"
PG_PASS="$(node -e "require('dotenv').config({path:'$ROOT/.env'});process.stdout.write(process.env.POSTGRES_PASSWORD||'')")"
CERT_CONTAINER="${FOREX_CERT_CONTAINER_NAME:-forex-cert-backend}"
LOG="$ROOT/.build/forex-cert-backend.log"
mkdir -p "$ROOT/.build"

export FOREX_CERT_DATABASE_URL="$CERT_URL"

echo "== Phase 1: DB identity =="
cd "$BACKEND"
FOREX_CERT_DATABASE_URL="$CERT_URL" npx tsx scripts/forex-cert-db-guard.ts

echo "== Live exchange DB protection (read-only name check) =="
docker exec exchange-postgres psql -U exchange -d exchange -tAc "SELECT current_database();" | grep -qx exchange

echo "== Seed cert fixtures =="
FOREX_CERT_DATABASE_URL="$CERT_URL" npx tsx scripts/forex-cert-seed.ts

echo "== DB runtime suite =="
FOREX_CERT_DATABASE_URL="$CERT_URL" npx tsx scripts/forex-cert-runtime-suite.ts

stop_cert() {
  docker rm -f "$CERT_CONTAINER" >/dev/null 2>&1 || true
}

start_cert() {
  stop_cert
  docker run -d --name "$CERT_CONTAINER" --network exchange-production \
    --env-file "$ROOT/.env" \
    -e RUN_MODE=api \
    -e PORT=4100 \
    -e NODE_ENV=development \
    -e "DATABASE_URL=postgresql://exchange:${PG_PASS}@postgres:5432/exchange_forex_cert?sslmode=disable" \
    -e REDIS_URL=redis://redis:6379 \
    -e ADMIN_2FA_MANDATORY=false \
    -e REAL_FOREX=false \
    -e MAKER_CHECKER_ENABLED=true \
    -e FOREX_DEMO_FUNDING=true \
    -e FOREX_DEMO_ZERO_SPREAD=true \
    -e FOREX_SILENT_LOG=1 \
    -p 127.0.0.1:4100:4100 \
    -v "$BACKEND:/app" -w /app \
    m-live-backend \
    sh -c "npx tsx src/server.ts" >>"$LOG" 2>&1
  for i in $(seq 1 60); do
    if curl -sf "http://127.0.0.1:4100/health" >/dev/null; then
      echo "Cert API ready on :4100"
      return 0
    fi
    sleep 2
  done
  echo "Cert API failed to start; tail $LOG"
  tail -80 "$LOG" || true
  exit 1
}

trap stop_cert EXIT

echo "== Phase 2: Start cert backend =="
start_cert

echo "== Phase 3: Process restart certification =="
TRADER_PW="${FOREX_CERT_TRADER_PASSWORD:-CertTrader1!}"
docker exec exchange-postgres psql -U exchange -d exchange_forex_cert -c \
  "UPDATE forex_accounts SET position_mode='HEDGING' WHERE account_id='CERT_ACC_B';"

PM1=$(curl -sf -X POST "http://127.0.0.1:4100/api/v1/auth/login/password" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"cert_trader_b@cert.local\",\"password\":\"$TRADER_PW\"}" | jq -r '.data.accessToken // .data.token // empty')
test -n "$PM1"
MODE1=$(curl -sf "http://127.0.0.1:4100/api/v1/forex/account/position-mode" -H "authorization: Bearer $PM1" | jq -r '.data.positionMode')
DB1=$(docker exec exchange-postgres psql -U exchange -d exchange_forex_cert -tAc "SELECT position_mode FROM forex_accounts WHERE account_id='CERT_ACC_B';")
echo "Before restart: db=$DB1 runtime=$MODE1"

docker restart "$CERT_CONTAINER" >/dev/null
for i in $(seq 1 60); do
  curl -sf "http://127.0.0.1:4100/health" >/dev/null && break
  sleep 2
done

PM2=$(curl -sf -X POST "http://127.0.0.1:4100/api/v1/auth/login/password" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"cert_trader_b@cert.local\",\"password\":\"$TRADER_PW\"}" | jq -r '.data.accessToken // .data.token // empty')
MODE2=$(curl -sf "http://127.0.0.1:4100/api/v1/forex/account/position-mode" -H "authorization: Bearer $PM2" | jq -r '.data.positionMode')
DB2=$(docker exec exchange-postgres psql -U exchange -d exchange_forex_cert -tAc "SELECT position_mode FROM forex_accounts WHERE account_id='CERT_ACC_B';")
echo "After restart: db=$DB2 runtime=$MODE2"
test "$DB2" = "HEDGING" && test "$MODE2" = "HEDGING"

echo "== Phase 4–10: API certification suite =="
FOREX_CERT_DATABASE_URL="$CERT_URL" FOREX_CERT_API_BASE="http://127.0.0.1:4100/api/v1/admin" \
  npx tsx scripts/forex-cert-api-suite.ts | tee "$ROOT/.build/forex-cert-api-suite.json"

echo "== Integration test (cert DB) =="
FOREX_CERT_DATABASE_URL="$CERT_URL" npx tsx src/services/forex/admin/forex-admin-cert.integration.test.ts

echo "ALL CERT STEPS COMPLETED"
