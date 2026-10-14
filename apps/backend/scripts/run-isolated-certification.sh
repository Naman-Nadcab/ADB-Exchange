#!/usr/bin/env bash
# Rerun backend certification against an isolated Postgres database and Redis.
# Refuses database name exchange/postgres, Redis port 6379, and the production host.
# The database must be a fresh migrate: one seed user and no sign-in wallets.
# Challenge and verify run first because they require that empty wallet state.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${CERT_DATABASE_URL:?Set CERT_DATABASE_URL to an isolated Postgres URL}"
: "${CERT_REDIS_URL:?Set CERT_REDIS_URL to an isolated Redis URL}"

export CERT_DATABASE_URL CERT_REDIS_URL
node --input-type=module <<'NODE'
const url = process.env.CERT_DATABASE_URL;
const redisRaw = process.env.CERT_REDIS_URL;
const dbUrl = new URL(url);
const name = decodeURIComponent(dbUrl.pathname.replace(/^\//, '').split('/')[0] ?? '');
if (name === 'exchange' || name === 'postgres' || name === '' || url.includes('169.58.39.2')) {
  console.error('Refusing certification against a non-isolated database');
  process.exit(1);
}
const redis = new URL(redisRaw);
if (redis.port === '6379' || (redis.hostname !== '127.0.0.1' && redis.hostname !== 'localhost')) {
  console.error('Refusing certification against a non-local Redis');
  process.exit(1);
}
console.log(JSON.stringify({ database: name, redis: `${redis.hostname}:${redis.port}` }));
NODE

export EXCHANGE_PRESERVE_SHELL_DATABASE_URL=1
export DATABASE_URL="$CERT_DATABASE_URL"
export REDIS_URL="$CERT_REDIS_URL"
export DATABASE_SSL_REJECT_UNAUTHORIZED=false
export DB_STATEMENT_TIMEOUT_MS="${DB_STATEMENT_TIMEOUT_MS:-120000}"
export LOG_LEVEL="${LOG_LEVEL:-error}"
export NODE_ENV=test
export JWT_SECRET="${JWT_SECRET:-test-jwt-secret-must-be-32-characters}"
export JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-test-refresh-secret-32-characters-min}"
export ENCRYPTION_KEY="${ENCRYPTION_KEY:-test-encryption-key-32-characters-min}"
export SESSION_SECRET="${SESSION_SECRET:-test-session-secret-32-characters-min}"
export CSRF_SECRET="${CSRF_SECRET:-test-csrf-secret-must-be-32-chars-min}"

echo "=== migrate ==="
../../node_modules/.bin/tsx src/database/migrate.ts
echo "=== migrate again ==="
../../node_modules/.bin/tsx src/database/migrate.ts

node --input-type=module <<'NODE'
import pg from 'pg';
const url = process.env.CERT_DATABASE_URL;
const dbUrl = new URL(url);
const name = decodeURIComponent(dbUrl.pathname.replace(/^\//, '').split('/')[0] ?? '');
const pool = new pg.Pool({ connectionString: url, ssl: false });
const current = await pool.query('SELECT current_database() AS name');
if (current.rows[0].name !== name) {
  console.error(`Connected database ${current.rows[0].name} does not match ${name}`);
  process.exit(1);
}
const counts = await pool.query(
  'SELECT (SELECT count(*)::int FROM users) AS users, (SELECT count(*)::int FROM user_wallets) AS wallets'
);
console.log(JSON.stringify({ database: name, users: counts.rows[0].users, wallets: counts.rows[0].wallets }));
if (counts.rows[0].users !== 1 || counts.rows[0].wallets !== 0) {
  console.error('Database is not a fresh certification migrate (need 1 seed user and 0 wallets).');
  process.exit(2);
}
await pool.end();
NODE

run() {
  local name="$1"
  shift
  echo "=== $name ==="
  "$@"
  echo "PASS suite $name"
}

export WALLET_CHALLENGE_TEST_DATABASE_URL="$CERT_DATABASE_URL"
export WALLET_CHALLENGE_TEST_REDIS_URL="$CERT_REDIS_URL"
export WALLET_VERIFY_TEST_DATABASE_URL="$CERT_DATABASE_URL"
export WALLET_VERIFY_TEST_REDIS_URL="$CERT_REDIS_URL"
export WALLET_LOGIN_TEST_DATABASE_URL="$CERT_DATABASE_URL"
export WALLET_LOGIN_TEST_REDIS_URL="$CERT_REDIS_URL"
export CUTOVER_TEST_DATABASE_URL="$CERT_DATABASE_URL"
export CUTOVER_TEST_REDIS_URL="$CERT_REDIS_URL"
export SPOT_P2P_WALLET_TEST_DATABASE_URL="$CERT_DATABASE_URL"
export SPOT_P2P_WALLET_TEST_REDIS_URL="$CERT_REDIS_URL"
export FOREX_WALLET_TEST_DATABASE_URL="$CERT_DATABASE_URL"
export FOREX_WALLET_TEST_REDIS_URL="$CERT_REDIS_URL"
export FOREX_KYC_CERT_DATABASE_URL="$CERT_DATABASE_URL"
export FOREX_KYC_CERT_REDIS_URL="$CERT_REDIS_URL"

TSX="../../node_modules/.bin/tsx"
run wallet-challenge "$TSX" src/routes/auth-wallet-challenge.integration.test.ts
run wallet-verify "$TSX" src/routes/auth-wallet-verify.integration.test.ts
run wallet-login "$TSX" src/routes/auth-wallet-login.integration.test.ts
run legacy-cutover "$TSX" src/routes/legacy-auth-cutover.integration.test.ts
run spot-p2p "$TSX" src/routes/spot-p2p-wallet-identity.integration.test.ts
run forex-identity "$TSX" src/routes/forex-wallet-identity.integration.test.ts
run forex-kyc-admin "$TSX" src/routes/forex-kyc-admin-http.integration.test.ts

echo "ISOLATED_CERTIFICATION_PASS"
