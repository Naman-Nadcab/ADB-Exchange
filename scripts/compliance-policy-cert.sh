#!/usr/bin/env bash
# Compliance Policy Engine certification — runtime toggle verification.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${E2E_BASE_URL:-http://127.0.0.1:4000}/api/v1"
ADMIN_API="${API}/admin"
PASS=0; FAIL=0

log() { echo "[compliance-cert] $*"; }
record() {
  local name="$1" status="$2" ev="$3"
  echo "| $name | $status | $ev |"
  [[ "$status" == PASS ]] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
}

ADMIN_JWT=$(curl -s -X POST "${ADMIN_API}/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('accessToken',''))" 2>/dev/null)
JWT_A=$(curl -s -X POST "${API}/auth/login/password" -H 'Content-Type: application/json' \
  -d '{"email":"qa_trader_a@local.exchange","password":"TestPass123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

log "Apply closed_beta preset"
curl -s -X POST "${ADMIN_API}/compliance/policy/apply-preset" \
  -H "Authorization: Bearer $ADMIN_JWT" -H 'Content-Type: application/json' \
  -d '{"preset":"closed_beta","reason":"Compliance certification closed beta mode test run"}' >/dev/null

sleep 1
PUBLIC=$(curl -s "${API}/public/compliance-policy")
KYC_WD=$(echo "$PUBLIC" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('kyc',{}).get('withdrawal',''))" 2>/dev/null)
[[ "$KYC_WD" == "disabled" ]] && record "Public API closed_beta KYC withdrawal" "PASS" "kyc.withdrawal=$KYC_WD" \
  || record "Public API closed_beta KYC withdrawal" "FAIL" "kyc.withdrawal=$KYC_WD"

# Spot order should succeed without KYC in closed_beta
SPOT=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API}/spot/order" -H "Authorization: Bearer $JWT_A" \
  -H 'Content-Type: application/json' \
  -d '{"market":"BTC_USDT","side":"buy","type":"limit","price":"85000","quantity":"0.0001","time_in_force":"gtc","client_order_id":"comp-cert-'$(date +%s)'"}')
[[ "$SPOT" == "200" || "$SPOT" == "201" ]] && record "Spot order closed_beta (no KYC block)" "PASS" "HTTP $SPOT" \
  || record "Spot order closed_beta" "FAIL" "HTTP $SPOT"

log "Apply production preset"
curl -s -X POST "${ADMIN_API}/compliance/policy/apply-preset" \
  -H "Authorization: Bearer $ADMIN_JWT" -H 'Content-Type: application/json' \
  -d '{"preset":"production","reason":"Compliance certification production mode test run"}' >/dev/null

sleep 1
PUBLIC2=$(curl -s "${API}/public/compliance-policy")
KYC_WD2=$(echo "$PUBLIC2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('kyc',{}).get('withdrawal',''))" 2>/dev/null)
[[ "$KYC_WD2" == "required" ]] && record "Public API production KYC withdrawal" "PASS" "kyc.withdrawal=$KYC_WD2" \
  || record "Public API production KYC withdrawal" "FAIL" "kyc.withdrawal=$KYC_WD2"

# Restore closed_beta for continued testing
curl -s -X POST "${ADMIN_API}/compliance/policy/apply-preset" \
  -H "Authorization: Bearer $ADMIN_JWT" -H 'Content-Type: application/json' \
  -d '{"preset":"closed_beta","reason":"Compliance certification restore closed beta after test"}' >/dev/null

log "PASS=$PASS FAIL=$FAIL"
[[ "$FAIL" -eq 0 ]]
