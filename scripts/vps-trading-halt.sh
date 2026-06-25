#!/usr/bin/env bash
# Emergency trading halt/resume via Redis (works when admin UI is unreachable).
# Usage:
#   bash scripts/vps-trading-halt.sh halt
#   bash scripts/vps-trading-halt.sh resume
#   bash scripts/vps-trading-halt.sh status
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.production.yml)
ACTION="${1:-status}"

case "$ACTION" in
  halt)
    "${COMPOSE[@]}" up -d redis >/dev/null
    "${COMPOSE[@]}" exec -T redis redis-cli SET trading_halt:global 1 >/dev/null
    echo "Trading HALTED (Redis key trading_halt:global=1)"
    echo "Also disable withdrawals in admin if incident involves funds."
    ;;
  resume)
    "${COMPOSE[@]}" exec -T redis redis-cli DEL trading_halt:global >/dev/null
    echo "Trading halt CLEARED — new spot/P2P orders allowed if no other circuit is open."
    echo "Confirm settlement circuit and per-market status before resuming."
    ;;
  status)
    val=$("${COMPOSE[@]}" exec -T redis redis-cli GET trading_halt:global 2>/dev/null || echo "")
    if [ "$val" = "1" ]; then
      echo "status: HALTED"
    else
      echo "status: NOT HALTED"
    fi
    ;;
  *)
    echo "Usage: $0 {halt|resume|status}" >&2
    exit 1
    ;;
esac
