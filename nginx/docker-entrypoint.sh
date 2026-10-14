#!/bin/sh
set -e

TLS_CERT="/etc/nginx/ssl/fullchain.pem"
TLS_KEY="/etc/nginx/ssl/privkey.pem"
CONF="/etc/nginx/nginx.conf"

mkdir -p /etc/nginx/conf.d
if [ -f /etc/nginx/ssl/wallet-browser/fullchain.pem ] && [ -f /etc/nginx/ssl/wallet-browser/privkey.pem ]; then
  cp /etc/nginx/nginx.wallet-browser.conf /etc/nginx/conf.d/wallet-browser.conf
else
  printf '' > /etc/nginx/conf.d/wallet-browser.conf
fi

if [ -f "$TLS_CERT" ] && [ -f "$TLS_KEY" ]; then
  echo "[nginx] TLS certificates found — enabling HTTPS (port 443) + HTTP redirect"
  cp /etc/nginx/nginx.tls.conf "$CONF"
else
  echo "[nginx] TLS certificates not found — HTTP-only mode on port 80"
  echo "[nginx] Generate certs: bash scripts/generate-self-signed-tls.sh <VPS_IP>"
  cp /etc/nginx/nginx.http-only.conf "$CONF"
fi

exec nginx -g 'daemon off;'
