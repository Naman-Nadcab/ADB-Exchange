#!/bin/sh
# Safe Crypto tier-1 regression on staging `exchange` DB (never forex cert DB).
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/apps/backend"
OUT="$ROOT/.build/forex-crypto-regression.json"
mkdir -p "$ROOT/.build"

PG_PASS="$(node -e "require('dotenv').config({path:'$ROOT/.env'});process.stdout.write(process.env.POSTGRES_PASSWORD||'')")"

if [ -z "${FOREX_CRYPTO_REGRESSION_INNER:-}" ] && docker ps --format '{{.Names}}' | grep -qx exchange-backend; then
  export FOREX_CRYPTO_REGRESSION_INNER=1
  docker exec \
    -e FOREX_CRYPTO_REGRESSION_INNER=1 \
    -e "POSTGRES_PASSWORD=${PG_PASS}" \
    exchange-backend sh "$ROOT/scripts/forex-safe-crypto-regression.sh"
  exit $?
fi

if [ -n "${FOREX_CRYPTO_REGRESSION_INNER:-}" ]; then
  export DATABASE_URL="postgresql://exchange:${PG_PASS}@postgres:5432/exchange?sslmode=disable"
  export REDIS_URL="${CRYPTO_REGRESSION_REDIS_URL:-redis://redis:6379}"
else
  export DATABASE_URL="postgresql://exchange:${PG_PASS}@127.0.0.1:5432/exchange?sslmode=disable"
  export REDIS_URL="${CRYPTO_REGRESSION_REDIS_URL:-redis://127.0.0.1:6379}"
fi

export E2E_BASE_URL="${E2E_BASE_URL:-http://127.0.0.1:4000}"
export TIER1_PHASE3_SKIP_SECURITY=true
export TIER1_AUTO_RECONCILE="${TIER1_AUTO_RECONCILE:-1}"
export EXCHANGE_PRESERVE_SHELL_DATABASE_URL=1
export EXCHANGE_VERIFY_STACK=1

cd "$BACKEND"
RESULTS_FILE="${TMPDIR:-/tmp}/forex-crypto-regression-phases.tmp"
: >"$RESULTS_FILE"
FAIL=0

run_phase() {
  name="$1"
  script="$2"
  echo "-- $name --"
  if npx tsx "$script"; then
    echo "\"$name\":\"PASS\"" >>"$RESULTS_FILE"
  else
    echo "\"$name\":\"FAIL\"" >>"$RESULTS_FILE"
    FAIL=1
  fi
}

run_phase "phase0_security" "scripts/phase0-security-verify.ts"
run_phase "phase1" "scripts/tier1-phase1-verify.ts"
run_phase "phase1_final_security" "scripts/phase1-final-security-verify.ts"
run_phase "phase2" "scripts/tier1-phase2-verify.ts"
run_phase "phase2_treasury" "scripts/phase2-treasury-verify.ts"
run_phase "phase3" "scripts/tier1-phase3-verify.ts"
run_phase "phase3_hardening" "scripts/phase3-ultra-hardening-verify.ts"
run_phase "phase4" "scripts/tier1-phase4-verify.ts"

RESULTS_JSON="{$(paste -sd, "$RESULTS_FILE")}"
node -e "
const fs=require('fs');
const body={generated_at:new Date().toISOString(),database:'exchange',api:process.env.E2E_BASE_URL,results:JSON.parse(process.argv[1]),runner:process.env.FOREX_CRYPTO_REGRESSION_INNER?'exchange-backend':'host'};
try { fs.writeFileSync('$OUT', JSON.stringify(body,null,2)); } catch (e) { fs.writeFileSync('/tmp/forex-crypto-regression.json', JSON.stringify(body,null,2)); console.error('wrote /tmp/forex-crypto-regression.json'); }
console.log(JSON.stringify(body.results));
" "$RESULTS_JSON"

rm -f "$RESULTS_FILE"
[ "$FAIL" -eq 0 ]
