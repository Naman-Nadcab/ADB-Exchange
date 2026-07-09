#!/usr/bin/env bash
# Ops reconcile — run before certs or after deploy (excludes hot-wallet funding).
set -euo pipefail
API="${E2E_BASE_URL:-http://127.0.0.1:4000}/api/v1"

echo "[ops] Unsuspend cert/local users..."
docker exec exchange-postgres psql -U exchange -d exchange -q -c \
  "UPDATE users SET spot_trading_suspended_at=NULL, spot_trading_suspend_reason=NULL
   WHERE email LIKE '%@local.exchange' OR email LIKE 'cert_%';"

echo "[ops] Cancel absurd open orders (>500k price) for cert users..."
JWT=$(curl -s -m 8 -X POST "$API/auth/login/password" -H 'Content-Type: application/json' \
  -d '{"email":"qa_trader_a@local.exchange","password":"TestPass123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null || echo "")
if [[ -n "$JWT" ]]; then
  curl -s -m 15 -X POST "$API/spot/orders/cancel-all" \
    -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' \
    -d '{"market":"BTC_USDT"}' >/dev/null || true
fi

echo "[ops] Purge failed settlement DLQ (when no pending)..."
docker exec exchange-postgres psql -U exchange -d exchange -q -c \
  "DELETE FROM settlement_events WHERE status='failed'
   AND NOT EXISTS (SELECT 1 FROM settlement_events WHERE status='pending');"

echo "[ops] Reset settlement circuit..."
docker exec exchange-redis redis-cli DEL settlement_circuit:open settlement_circuit:opened_at >/dev/null

ADM=$(curl -s -m 8 -X POST "$API/admin/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null || echo "")
if [[ -n "$ADM" ]]; then
  curl -s -m 10 -X POST "$API/admin/settlement/circuit-reset" \
    -H "Authorization: Bearer $ADM" -H 'Content-Type: application/json' \
    -d '{"reason":"ops-exchange-reconcile"}' >/dev/null || true
fi

echo "[ops] Health:"
curl -s -m 8 http://127.0.0.1:4000/health | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('status'), d.get('warnings'), d.get('stale_markets'))"
