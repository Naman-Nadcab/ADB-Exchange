#!/usr/bin/env bash
# First production boot on VPS (IP-first, no domain required).
# Does NOT disable security gates or KMS.
#
# Usage:
#   cp .env.production.example .env   # edit all CHANGE_ME + VPS_PUBLIC_IP
#   bash scripts/vps-first-boot.sh
#
# Options:
#   SKIP_TLS=1           Skip self-signed cert generation
#   SKIP_BUILD=1         Skip image build (pull-only / CI images)
#   SKIP_MIGRATE=1       Skip DB migrations
#   SKIP_SEED=1          Skip admin seed
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.production.yml)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

fail() { echo -e "${RED}FAIL:${NC} $*" >&2; exit 1; }
ok() { echo -e "${GREEN}OK:${NC} $*"; }
warn() { echo -e "${YELLOW}WARN:${NC} $*"; }

if [ ! -f .env ]; then
  fail "Create .env from .env.production.example first"
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

required_vars=(
  POSTGRES_PASSWORD RABBITMQ_PASSWORD
  JWT_SECRET JWT_REFRESH_SECRET ENCRYPTION_KEY
  SESSION_SECRET CSRF_SECRET
  ENGINE_HMAC_SECRET ENGINE_INTERNAL_SECRET
  INTERNAL_HMAC_SERVICE_SECRETS INTERNAL_API_ALLOW_CIDRS
  ADMIN_IP_WHITELIST SLO_IP_WHITELIST
  AWS_KMS_KEY_ID AWS_REGION
)

for v in "${required_vars[@]}"; do
  val="${!v:-}"
  if [ -z "$val" ] || [[ "$val" == CHANGE_ME* ]]; then
    fail "$v is unset or still a placeholder in .env"
  fi
done

if [ -z "${AWS_ACCESS_KEY_ID:-}" ] && [ -z "${AWS_CONTAINER_CREDENTIALS_RELATIVE_URI:-}" ]; then
  warn "AWS_ACCESS_KEY_ID not set — ensure instance role or ~/.aws credentials exist for KMS probe"
fi

VPS_IP="${VPS_PUBLIC_IP:-}"
if [ -z "$VPS_IP" ]; then
  warn "VPS_PUBLIC_IP not set — TLS self-sign and PUBLIC_* URLs may be wrong"
fi

echo "=== Step 1: TLS (optional self-signed for VPS IP) ==="
if [ "${SKIP_TLS:-0}" != "1" ]; then
  if [ ! -f nginx/ssl/fullchain.pem ] || [ ! -f nginx/ssl/privkey.pem ]; then
    if [ -n "$VPS_IP" ]; then
      bash scripts/generate-self-signed-tls.sh "$VPS_IP"
    else
      warn "No TLS certs and no VPS_PUBLIC_IP — nginx will use HTTP-only on port 80"
    fi
  else
    ok "TLS certs already present in nginx/ssl/"
  fi
else
  warn "SKIP_TLS=1 — nginx uses HTTP-only unless certs exist"
fi

echo "=== Step 2: Core infra ==="
"${COMPOSE[@]}" up -d postgres redis rabbitmq nats
for i in $(seq 1 90); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "${POSTGRES_USER:-exchange}" >/dev/null 2>&1 \
    && "${COMPOSE[@]}" exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
    ok "Postgres + Redis ready"
    break
  fi
  [ "$i" -eq 90 ] && fail "Infra not ready"
  sleep 2
done

echo "=== Step 3: Database migrations ==="
if [ "${SKIP_MIGRATE:-0}" != "1" ]; then
  bash scripts/vps-migrate.sh
else
  warn "SKIP_MIGRATE=1"
fi

echo "=== Step 4: Build & start application stack ==="
if [ "${SKIP_BUILD:-0}" = "1" ]; then
  "${COMPOSE[@]}" up -d --remove-orphans
else
  "${COMPOSE[@]}" up -d --build --remove-orphans
fi

echo "=== Step 5: Wait for backend healthy ==="
for i in $(seq 1 120); do
  if "${COMPOSE[@]}" exec -T backend wget -q -O /dev/null http://127.0.0.1:4000/health/live 2>/dev/null; then
    ok "Backend liveness OK"
    break
  fi
  [ "$i" -eq 120 ] && fail "Backend did not become healthy — check: docker compose -f docker-compose.production.yml logs backend"
  sleep 3
done

echo "=== Step 6: Admin seed ==="
if [ "${SKIP_SEED:-0}" != "1" ]; then
  bash scripts/vps-seed-admin.sh
else
  warn "SKIP_SEED=1"
fi

echo "=== Step 7: Health verification ==="
if [ -f nginx/ssl/fullchain.pem ]; then
  bash scripts/vps-health-check.sh "https://${VPS_IP:-127.0.0.1}" || warn "HTTPS check failed (self-signed curl may need -k)"
  curl -skf "https://${VPS_IP:-127.0.0.1}/health/live" >/dev/null && ok "HTTPS liveness" || true
else
  bash scripts/vps-health-check.sh "http://${VPS_IP:-127.0.0.1}"
fi

ok "First boot complete"
echo ""
echo "Next steps:"
echo "  1. Change admin passwords (seed defaults are in apps/backend/seed-admin.ts)"
echo "  2. Schedule backups: bash scripts/vps-backup-db.sh (cron daily recommended)"
echo "  3. Save deploy revision before updates: bash scripts/vps-save-deploy-rev.sh"
echo "  4. Configure SMTP/SMS in admin → Integrations"
echo "  5. Provision hot wallets: bash scripts/provision-hot-wallets.sh"
echo "  6. When domain is ready: update .env PUBLIC_* URLs, rebuild frontend/admin, replace TLS with Let's Encrypt"
