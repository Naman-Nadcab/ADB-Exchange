#!/usr/bin/env bash
# Cert-pinned admin UI for Playwright (3010 → API 4100).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN="$ROOT/apps/admin-panel"
PIDFILE="$ROOT/.build/forex-cert-admin-ui.pid"
LOG="$ROOT/.build/forex-cert-admin-ui.log"
mkdir -p "$ROOT/.build"

admin_ready() {
  curl -sf "http://127.0.0.1:3010/admin/login" >/dev/null 2>&1
}

if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null && admin_ready \
  && curl -sf "http://127.0.0.1:3010/admin/forex/crm/home" >/dev/null 2>&1; then
  echo "Admin UI already running pid $(cat "$PIDFILE")"
else
  if [ -f "$PIDFILE" ]; then
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
    rm -f "$PIDFILE"
  fi
  # Reclaim stale listener (old build without Phase A routes).
  if command -v fuser >/dev/null 2>&1; then
    fuser -k 3010/tcp >/dev/null 2>&1 || true
  fi
  cd "$ADMIN"
  export NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-http://127.0.0.1:4100}"
  if [ ! -d .next ] || [ "${FOREX_CERT_ADMIN_UI_FORCE_BUILD:-0}" = "1" ]; then
    echo "Building admin (cert API)…"
    npm run build
  fi
  npx next start -p 3010 -H 127.0.0.1 >>"$LOG" 2>&1 &
  echo $! >"$PIDFILE"
  for i in $(seq 1 30); do
    curl -sf "http://127.0.0.1:3010/admin/login" >/dev/null && break
    sleep 2
  done
fi

cd "$ROOT"
FOREX_ADMIN_UI_E2E=1 FOREX_ADMIN_UI_BASE=http://127.0.0.1:3010/admin \
  npx playwright test -c playwright.forex-admin.config.ts --project=forex-admin-ui --project=forex-admin-functional
