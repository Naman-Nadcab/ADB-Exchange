#!/usr/bin/env bash
# Install a Let's Encrypt certificate for the public VPS IP and reload nginx.
# IP certificates use the shortlived profile and last about six days.
# Usage:
#   bash scripts/renew-ip-tls.sh issue
#   bash scripts/renew-ip-tls.sh renew
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ACTION="${1:-renew}"
IP="${TLS_IP:-169.58.39.2}"
CERTBOT="${CERTBOT_BIN:-/opt/certbot/bin/certbot}"
WEBROOT="$ROOT/nginx/acme"
SSL_DIR="$ROOT/nginx/ssl"

install_live() {
  local live="/etc/letsencrypt/live/${IP}"
  if [ ! -f "$live/fullchain.pem" ] || [ ! -f "$live/privkey.pem" ]; then
    echo "No certificate at $live" >&2
    exit 1
  fi
  install -m 644 "$live/fullchain.pem" "$SSL_DIR/fullchain.pem"
  install -m 600 "$live/privkey.pem" "$SSL_DIR/privkey.pem"
  if docker ps --format '{{.Names}}' | grep -qx exchange-nginx; then
    docker exec exchange-nginx nginx -s reload
  fi
  echo "Installed Let's Encrypt certificate for $IP"
}

mkdir -p "$WEBROOT" "$SSL_DIR"

case "$ACTION" in
  issue)
    "$CERTBOT" certonly \
      --non-interactive \
      --agree-tos \
      --register-unsafely-without-email \
      --preferred-profile shortlived \
      --webroot \
      --webroot-path "$WEBROOT" \
      --ip-address "$IP" \
      --deploy-hook "bash $ROOT/scripts/renew-ip-tls.sh install"
    install_live
    conf="/etc/letsencrypt/renewal/${IP}.conf"
    if [ -f "$conf" ] && ! grep -q '^renew_before_expiry' "$conf"; then
      sed -i '/^\[renewalparams\]/a renew_before_expiry = 2 days' "$conf"
    fi
    ;;
  renew)
    "$CERTBOT" renew --quiet --deploy-hook "bash $ROOT/scripts/renew-ip-tls.sh install"
    ;;
  install)
    install_live
    ;;
  *)
    echo "Usage: $0 issue|renew|install" >&2
    exit 1
    ;;
esac
