#!/usr/bin/env bash
# Configure UFW firewall for exchange production stack.
# Run as root once per VPS.
#
# Usage: sudo bash deployment/firewall.sh
set -euo pipefail

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Run as root: sudo bash deployment/firewall.sh"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH_PORT="${SSH_PORT:-22}"
HTTP_PORT="${HTTP_PORT:-80}"
HTTPS_PORT="${HTTPS_PORT:-443}"
GRAFANA_PORT="${GRAFANA_PORT:-3001}"

echo "=== UFW configuration ==="
ufw default deny incoming
ufw default allow outgoing
ufw allow "${SSH_PORT}/tcp" comment 'SSH'
ufw allow "${HTTP_PORT}/tcp" comment 'HTTP'
ufw allow "${HTTPS_PORT}/tcp" comment 'HTTPS'
# Restrict Grafana to localhost + admin IPs in production
ufw allow from 127.0.0.1 to any port "${GRAFANA_PORT}" proto tcp comment 'Grafana local'
ufw --force enable
ufw status verbose
echo ""
echo "Restrict Grafana (:${GRAFANA_PORT}) to operator IPs in production."
echo "PostgreSQL (:5432) must remain bound to 127.0.0.1 only (compose default)."
