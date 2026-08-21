#!/usr/bin/env bash
# Install host prerequisites on a fresh Ubuntu VPS (22.04 / 24.04).
# Run once after git clone. Does NOT deploy the application.
#
# Usage: sudo bash deployment/install.sh
set -euo pipefail

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Run as root: sudo bash deployment/install.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "=== Exchange — Host Installation ==="

apt-get update -qq
apt-get install -y -qq \
  ca-certificates curl git gnupg lsb-release ufw \
  openssl rsync unzip wget

if ! command -v docker >/dev/null 2>&1; then
  echo "=== Installing Docker ==="
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable docker
  systemctl start docker
fi

docker --version
docker compose version

# Optional: add deploy user to docker group
DEPLOY_USER="${SUDO_USER:-${DEPLOY_USER:-}}"
if [[ -n "$DEPLOY_USER" ]] && id "$DEPLOY_USER" >/dev/null 2>&1; then
  usermod -aG docker "$DEPLOY_USER" || true
  echo "Added user '$DEPLOY_USER' to docker group (re-login required)"
fi

mkdir -p /opt/exchange
echo ""
echo "=== Host installation complete ==="
echo "Next steps:"
echo "  1. Clone repository into /opt/exchange (or your chosen path)"
echo "  2. cp .env.production.example .env && edit secrets"
echo "  3. bash deployment/deploy.sh"
