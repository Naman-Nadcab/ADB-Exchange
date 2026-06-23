#!/usr/bin/env bash
# Generate self-signed TLS for VPS-IP first boot (replace with Let's Encrypt when domain is ready).
# Usage: bash scripts/generate-self-signed-tls.sh [VPS_IP_OR_HOST]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSL_DIR="$ROOT/nginx/ssl"
HOST="${1:-}"

if [ -z "$HOST" ]; then
  if [ -f "$ROOT/.env" ]; then
    # shellcheck disable=SC1090
    set -a; source "$ROOT/.env"; set +a
    HOST="${VPS_PUBLIC_IP:-${VPS_PUBLIC_URL#https://}}"
    HOST="${HOST#http://}"
    HOST="${HOST%%/*}"
  fi
fi

if [ -z "$HOST" ]; then
  echo "Usage: $0 <VPS_IP_OR_HOSTNAME>"
  echo "  Or set VPS_PUBLIC_IP in .env"
  exit 1
fi

mkdir -p "$SSL_DIR"
OPENSSL_CFG="$(mktemp)"
trap 'rm -f "$OPENSSL_CFG"' EXIT

cat > "$OPENSSL_CFG" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
CN = $HOST

[v3_req]
subjectAltName = @alt_names

[alt_names]
IP.1 = $HOST
DNS.1 = $HOST
EOF

# If HOST looks like IP, only IP SAN; if hostname, prefer DNS
if [[ "$HOST" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  cat > "$OPENSSL_CFG" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
CN = $HOST

[v3_req]
subjectAltName = @alt_names

[alt_names]
IP.1 = $HOST
EOF
fi

openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout "$SSL_DIR/privkey.pem" \
  -out "$SSL_DIR/fullchain.pem" \
  -config "$OPENSSL_CFG"

chmod 600 "$SSL_DIR/privkey.pem"
chmod 644 "$SSL_DIR/fullchain.pem"

echo "TLS written to $SSL_DIR/"
echo "  fullchain.pem"
echo "  privkey.pem"
echo "Restart nginx after deploy: docker compose -f docker-compose.production.yml restart nginx"
