#!/usr/bin/env bash
# Incident recovery drill — restart infra services and verify health recovers.
#
# Usage:
#   BASE_URL=http://109.123.254.30 bash scripts/incident-drill.sh
#   BASE_URL=http://127.0.0.1:4000 DRILL_SERVICES="redis nats" bash scripts/incident-drill.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.production.yml)
BASE_URL="${BASE_URL:-http://127.0.0.1}"
TIMEOUT_SEC="${DRILL_TIMEOUT_SEC:-90}"
STACK_SERVICES="${DRILL_SERVICES:-redis nats rabbitmq}"

echo "== Incident drill start =="
echo "base_url=${BASE_URL}"
echo "services=${STACK_SERVICES}"
echo "compose=${COMPOSE[*]}"

curl -fsS "${BASE_URL}/health/live" >/dev/null
echo "[ok] baseline live health"

wait_for_live() {
  local deadline
  deadline=$((SECONDS + TIMEOUT_SEC))
  while ((SECONDS < deadline)); do
    if curl -fsS "${BASE_URL}/health/live" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

for svc in ${STACK_SERVICES}; do
  echo
  echo "== drill: restart ${svc} =="
  "${COMPOSE[@]}" restart "${svc}" >/dev/null
  if wait_for_live; then
    echo "[ok] ${svc} restart recovered within ${TIMEOUT_SEC}s"
  else
    echo "[fail] ${svc} restart did not recover in time"
    exit 1
  fi
done

echo
echo "== final deep health =="
curl -fsS "${BASE_URL}/health" | sed 's/.*/[health] &/'
echo
echo "INCIDENT_DRILL_OK"
