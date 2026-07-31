#!/usr/bin/env bash
# Rewrite docker-compose hostnames to loopback for scripts running on the host.
host_db_url() {
  local raw="${1:-}"
  if [[ -z "$raw" ]]; then
    if [[ -f "${ROOT:-.}/.env" ]]; then
      raw="$(grep -E '^DATABASE_URL=' "${ROOT:-.}/.env" | head -1 | cut -d= -f2- | tr -d '"')"
    fi
  fi
  echo "$raw" | sed 's/@postgres:/@127.0.0.1:/' | sed 's/postgres:\([0-9]\)/127.0.0.1:\1/'
}

host_redis_url() {
  local raw="${1:-}"
  if [[ -z "$raw" ]]; then
    if [[ -f "${ROOT:-.}/.env" ]]; then
      raw="$(grep -E '^REDIS_URL=' "${ROOT:-.}/.env" | head -1 | cut -d= -f2- | tr -d '"')"
    fi
  fi
  echo "$raw" | sed 's/redis:\/\/redis:/redis:\/\/127.0.0.1:/'
}
